"""
Синхронизация сотрудников из МедОДС в таблицу staff.
Запуск: python run_sync_staff.py
"""
import asyncio
from app.db.database import async_session_factory
from app.services.staff_collector import collect_staff


async def main():
    print("Запускаем синхронизацию сотрудников...")
    async with async_session_factory() as db:
        result = await collect_staff(db)
    print(f"Готово: {result}")


if __name__ == "__main__":
    asyncio.run(main())
