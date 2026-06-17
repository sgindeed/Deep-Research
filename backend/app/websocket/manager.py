import logging
from typing import Dict
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("WebSocketManager")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[UUID, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: UUID):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} successfully connected to live stream.")

    def disconnect(self, client_id: UUID):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected from stream.")

    async def send_research_update(self, client_id: UUID, agent: str, progress: float, message: str):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            payload = {"event": "progress", "agent": agent, "progress": progress, "message": message}
            try:
                await websocket.send_json(payload)
            except Exception as e:
                logger.warning(f"Failed to send update to {client_id}. Error: {str(e)}")
                self.disconnect(client_id)

    async def send_simulation_update(self, client_id: UUID, payload_data: dict):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            payload = {"event": "simulation", "data": payload_data}
            try:
                await websocket.send_json(payload)
            except Exception as e:
                logger.warning(f"Failed to send sim update to {client_id}. Error: {str(e)}")
                self.disconnect(client_id)

ws_manager = ConnectionManager()