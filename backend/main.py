import os
import pandas as pd
from pathlib import Path
import shutil
import uuid
import json
from typing import Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from utils.utils import ply_to_dataframe, clean_gpt_code, get_latest_assistant_reply

load_dotenv()

#router = APIRouter()
openai_api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Allow CORS for frontend (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

openai = OpenAI(api_key=openai_api_key)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
INSTRUCTION_FILE = Path("assistant-data/instructions.txt")

SAFE_BUILTINS = {
    "len": len,
    "sum": sum,
    "max": max,
    "min": min,
    "sorted": sorted,
    "round": round,
    "abs": abs,
    "any": any,
    "all": all,
    "set": set,
    "list": list,
    "dict": dict,
}

# Load assistant instructions from file
if not INSTRUCTION_FILE.exists():
    raise FileNotFoundError("instructions.txt file is missing.")

with INSTRUCTION_FILE.open("r", encoding="utf-8") as f:
    assistant_instructions = f.read()

# Creating (or loading) a persistent custom assistant:
assistant_id = None
if not assistant_id:
    assistant = openai.beta.assistants.create(
        name="3DPointCloud Analyst",
        instructions=assistant_instructions,
        tools=[],
        model="gpt-4"
    )
    assistant_id = assistant.id

# Request schema
class ChatRequest(BaseModel):
    message: str

class AnalyticsRequest(BaseModel):
    csv_name: str
    question: str
    thread_id: Optional[str] = None

@app.post("/api/chat")
async def chat(req: ChatRequest):
    # GPT call
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": req.message}
        ]
    )
    reply = response.choices[0].message.content.strip()
    return {"reply": reply}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """ Uploads the PLY file, converts it to CSV and saves it server-side
    for further processing.
    """
    # Save the ply file temporarily.
    extension = Path(file.filename).suffix
    if extension != ".ply":
        return {"error": "Only .ply files are supported!"}
    
    temp_file_name = f"{uuid.uuid4().hex}{extension}"
    temp_save_path = UPLOAD_DIR / temp_file_name

    with temp_save_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Reading the PLY file and converting it to dataframe.
    df = ply_to_dataframe(temp_save_path)

    # Saving the dataframe as CSV.
    csv_file_name = temp_file_name.replace('.ply', '.csv')
    csv_save_path = UPLOAD_DIR / csv_file_name
    df.to_csv(csv_save_path, index=False)

    # Deleting temporary file.
    temp_save_path.unlink(missing_ok=True) 

    return {"file_path": csv_save_path}

@app.post("/api/analyze")
def analyze_point_cloud(req: AnalyticsRequest):
    csv_path = Path(req.csv_name)
    if not csv_path.exists():
        print("CSV path: ", str(csv_path))
        return {"error": "CSV file not found."}

    df = pd.read_csv(csv_path)

    # Reuse existing thread if applicable.
    if req.thread_id:
        thread_id = req.thread_id
    else:
        thread = openai.beta.threads.create()
        thread_id = thread.id

    # Step 1: Ask GPT for an appropriate response.
    prompt = f"Generate a valid response for this question: {req.question}. If needed, provide a single line of valid Python code to extract the required information from the DataFrame named `df`."

    openai.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=prompt
    )

    # Capture existing assistant messages before the run
    seen_ids = set(msg.id for msg in openai.beta.threads.messages.list(thread_id=thread_id).data)

    run = openai.beta.threads.runs.create_and_poll(
        thread_id=thread_id,
        assistant_id=assistant_id
    )

    reply = get_latest_assistant_reply(thread_id, previous_ids=seen_ids)
    if not reply:
        return {"error": "No assistant response to prompt."}
    
    # Converting string to JSON.
    reply_json = json.loads(reply.content[0].text.value)

    if reply_json['answerType'] == 'text':
        print("Answer type: ", reply_json['answerType'])
        print("Answer content: ", reply_json['answerContent'])
        return {"type": reply_json['answerType'], "explanation": reply_json['answerContent'], "thread_id": thread_id}
    elif reply_json['answerType'] ==  'code':
        print("Answer type: ", reply_json['answerType'])
        print("Answer content: ", reply_json['answerContent'])
        # Assuming only two valid types of `answerType`, with the second being `code`.
        # We safely evaluate the code.
        try:
            clean_code = clean_gpt_code(reply_json['answerContent'])
            code_result = eval(clean_code, {"__builtins__": SAFE_BUILTINS}, {"df": df})
            if isinstance(code_result, pd.Series) or isinstance(code_result, pd.DataFrame):
                code_output = code_result.to_string()
            else:
                code_output = str(code_result)
        except Exception as e:
            return {"error": "Code execution failed", "details": str(e), "code": clean_code}
        
        # Summarizing the result via GPT.
        prompt = f"Please explain the result of this Python output in a user-friendly way:\n\n{code_output} to answer this question: {req.question}. Avoid any metatext mentioning the output (e.g., 'the output indicates...')."
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=prompt
        )

        seen_ids.add(reply.id)  # Add previous assistant message ID.

        run = openai.beta.threads.runs.create_and_poll(
            thread_id=thread_id,
            assistant_id=assistant_id
        )

        summary_reply = get_latest_assistant_reply(thread_id, previous_ids=seen_ids)
        if not summary_reply:
            return {"error": "No assistant response to code summary prompt."}
        
        seen_ids.add(summary_reply.id)  # Add previous assistant message ID.
        
        summary_reply_json = json.loads(summary_reply.content[0].text.value)

        print("Answer type: ", summary_reply_json['answerType'])
        print("Answer content: ", summary_reply_json['answerContent'])

        return {"type": summary_reply_json['answerType'], "explanation": summary_reply_json['answerContent'], "thread_id": thread_id}
    else:
        # Here, we will request the UI to generate a plot based on this information.
        plot_config = {
            #"plotType": reply_json['plotType'],
            "x": reply_json['x'],
            "y": reply_json['y'],
            "xLabel": reply_json['xLabel'],
            "yLabel": reply_json['yLabel']
        }
        print("Answer type: ", reply_json['answerType'])
        print("Plot type: ", reply_json['plotType'])
        print("X: ", reply_json['x'])
        print("Y: ", reply_json['y'])
        print("X-label: ", reply_json['xLabel'])
        print("Y-label: ", reply_json['yLabel'])
        print("Plot summary: ", reply_json['summary'])
        return {"type": reply_json['answerType'], "plot_type": reply_json['plotType'], "explanation": reply_json['summary'], "config": plot_config, "thread_id": thread_id}

@app.on_event("shutdown")
def cleanup_upload_dir():
    """Delete all CSV files in the upload directory on shutdown."""
    for file_path in UPLOAD_DIR.glob("*.csv"):
        try:
            file_path.unlink()
            print(f"Deleted: {file_path}")
        except Exception as e:
            print(f"Failed to delete {file_path}: {e}")

@app.on_event("startup")
def cleanup_on_startup():
    for file_path in UPLOAD_DIR.glob("*.csv"):
        try:
            file_path.unlink()
        except Exception:
            pass
