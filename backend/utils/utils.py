import os
import json
import re
from pathlib import Path
import pandas as pd
from plyfile import PlyData

from openai import OpenAI

def ply_to_dataframe(ply_path: Path) -> pd.DataFrame:
    ply_data = PlyData.read(ply_path.open("rb"))
    vertex_data = ply_data['vertex'].data

    df = pd.DataFrame(vertex_data.tolist(), columns=vertex_data.dtype.names)

    # Re-naming relevant columns and adding point IDs.
    df.columns = df.columns.str.replace('scalar_', '')
    df.insert(loc=0, column='ID', value=df.index)
    df['ID'] = df['ID'].astype('uint32')
    df['class'] = df['class'].astype('uint8')
    df['ground_truth'] = df['ground_truth'].astype('uint8')

    # For memory reasons, we wanna save the RGB values as uint8 - so we need to
    # convert them from [0, 1] to [0, 255] if needed.
    if set(['red', 'green', 'blue']) <= set(df.columns):
        if (df['red'] <= 1).all():
            df['red'] *= 255
            df['green'] *= 255
            df['blue'] *= 255
        for col in ['red', 'green', 'blue']:
            df[col] = df[col].astype('uint8')
    elif set(['r', 'g', 'b']) <= set(df.columns):
        if (df['r'] <= 1).all():
            df['r'] *= 255
            df['g'] *= 255
            df['b'] *= 255
        for col in ['r', 'g', 'b']:
            df[col] = df[col].astype('uint8')
    else:
        pass

    return df

def clean_gpt_code(raw_code: str) -> str:
    # Remove markdown code block wrappers
    code = re.sub(r"^```(?:python)?", "", raw_code.strip(), flags=re.IGNORECASE)
    code = re.sub(r"```$", "", code.strip())
    return code.strip()

# Utility to get the newest assistant message after a run
def get_latest_assistant_reply(thread_id, previous_ids=set()):
    openai_api_key = os.getenv("OPENAI_API_KEY")
    openai = OpenAI(api_key=openai_api_key)

    messages = openai.beta.threads.messages.list(thread_id=thread_id)
    for msg in messages.data:
        if msg.role == "assistant" and msg.id not in previous_ids:
            return msg
    return None