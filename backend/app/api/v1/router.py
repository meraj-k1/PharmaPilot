from fastapi import APIRouter

from app.api.health import router as health_router
from app.modules.auth.controllers import router as auth_router
from app.modules.conversations.controllers import router as coversation_router
from app.modules.inventory.controllers import router as inventory_router
from app.modules.knowledge.controllers import router as knowledge_router
from app.modules.medicines.controllers import router as medicine_router
from app.modules.purchases.controllers import router as purchase_router
from app.modules.suppliers.controllers import router as supplier_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(medicine_router)
api_router.include_router(supplier_router)
api_router.include_router(inventory_router)
api_router.include_router(purchase_router)
api_router.include_router(coversation_router)
api_router.include_router(knowledge_router)
