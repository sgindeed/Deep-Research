import logging
from typing import Dict
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("WebSocketManager")

class ConnectionManager:
    """
    Manages active WebSocket connections for live research timeline streaming.
    Handles memory cleanup automatically on client disconnects.
    """
    def __init__(self):
        # Maps research session UUIDs to active WebSocket instances
        self.active_connections: Dict[UUID, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: UUID):
        """Accepts and stores a new websocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} successfully connected to live research stream.")

    def disconnect(self, client_id: UUID):
        """Removes a client from the active connections pool."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected from stream.")

    async def send_research_update(self, client_id: UUID, agent: str, progress: float, message: str):
        """
        Pushes a structured JSON update to a specific research client.
        Gracefully handles broken pipes if the client drops unexpectedly.
        """
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            payload = {
                "event": "progress",
                "agent": agent,
                "progress": progress,
                "message": message
            }
            try:
                await websocket.send_json(payload)
            except Exception as e:
                logger.warning(f"Failed to send update to {client_id}. Dropping connection. Error: {str(e)}")
                self.disconnect(client_id)

# Global singleton instance to be imported by routes and background tasks
ws_manager = ConnectionManager()