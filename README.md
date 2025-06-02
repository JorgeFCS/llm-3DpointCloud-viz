# delphi3d
 LLM-powered interface to interact with XAI-generated 3D point cloud visualizations.

## Backend
The backend uses the [FastAPI](https://fastapi.tiangolo.com/). The required dependencies are specified in `environment.yml`. You can create an environment with this file using:
```
conda env create -f environment.yml
```

To run the backend development server, run the following command in the command line within the `backend` directory:
```
uvicorn main:app --reload
```

### Communication with OpenAI API
To enable communication with the [OpenAI API](https://platform.openai.com/docs/overview), you need to update the `backend/.env` file with your OpenAI API key. Note that you need a valid key for the system to be able to connect to OpenAI's servers.

## Frontend
The frontend uses [React](https://react.dev/). The required dependencies are specified in `package.json`; you can install them by running:
```
npm install
```

To run the frontend development server, run the following command in the command line within the `frontend` directory:
```
npm start
```

You can find a sample 3D point cloud for testing purposes at `frontend/public/sample_point_cloud.ply`.

**Note that both the backend and the frontend should be running for the correct functionality of the system.**
