from fastapi import APIRouter, Depends

from app.core.auth import CurrentUser, current_user

router = APIRouter()


@router.get("/me")
async def me(user: CurrentUser = Depends(current_user)):
    """Кто сейчас вошёл. Фронтенд использует для приветствия и (позже) для прав."""
    return {"id": user.id, "name": user.name, "role": user.role}
