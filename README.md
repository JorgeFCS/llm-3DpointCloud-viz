# delphi3d
 LLM-powered interface to interact with XAI-generated 3D point cloud visualizations.

## Backend
The backend uses the [FastAPI](https://fastapi.tiangolo.com/). The required dependencies are specified in `environment.yml`.

To run the backend development server, run the following command in the command line within the `backend` directory:
```
uvicorn main:app --reload
```

## Frontend
The frontend uses [React](https://react.dev/). The required dependencies are specified in `package.json`.

To run the frontend development server, run the following command in the command line within the `frontend` directory:
```
npm start
```
