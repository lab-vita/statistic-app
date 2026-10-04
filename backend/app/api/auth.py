from fastapi import APIRouter, Depends

from app.core.auth import CurrentUser, current_user

router = APIRouter()


@router.get("/me")
async def me(user: CurrentUser = Depends(current_user)):
    """Кто сейчас вошёл и что ему можно. Фронтенд по этому решает, что показывать."""
    return {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "permissions": sorted(user.permissions),
    }
