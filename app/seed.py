from datetime import datetime

from app.database import SessionLocal, engine, Base
from app.models.bills import Meter, MeterReading, ServiceType
from app.models.users import User
from app.security import get_password_hash

INITIAL_SERVICES = [
    {"name": "Холодное водоснабжение", "unit": "м³"},
    {"name": "Горячее водоснабжение", "unit": "м³"},
    {"name": "Электроснабжение", "unit": "кВт·ч"},
    {"name": "Газоснабжение", "unit": "м³"},
    {"name": "Отопление", "unit": "Гкал"},
]

DEMO_USERS = [
    {
        "username": "Петров",
        "email": "petrov@samara.ru",
        "password": "user1234",
        "street": "ул. Ново-Садовая",
        "house": "21",
        "apartment": "15",
        "floor": "4",
        "monthly_budget": 6000.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-001", "current_tariff": 5.73, "readings": [12450, 12750, 13090, 13450]},
            {"service_type_id": 1, "serial_number": "ХВ-2026-001", "current_tariff": 42.30, "readings": [200, 212, 225, 239]},
        ],
    },
    {
        "username": "Смирнова",
        "email": "smirnova@samara.ru",
        "password": "user1234",
        "street": "ул. Куйбышева",
        "house": "103",
        "apartment": "44",
        "floor": "7",
        "monthly_budget": 4000.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-002", "current_tariff": 5.73, "readings": [9800, 10080, 10380, 10710]},
            {"service_type_id": 2, "serial_number": "ГВ-2026-002", "current_tariff": 165.00, "readings": [140, 146, 153, 160]},
            {"service_type_id": 4, "serial_number": "ГЗ-2026-002", "current_tariff": 8.10, "readings": [540, 558, 578, 600]},
        ],
    },
    {
        "username": "Козлов",
        "email": "kozlov@samara.ru",
        "password": "user1234",
        "street": "ул. Полевая",
        "house": "4",
        "apartment": "12",
        "floor": "2",
        "monthly_budget": 2800.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-003", "current_tariff": 5.73, "readings": [7300, 7550, 7820, 8120]},
            {"service_type_id": 5, "serial_number": "ОТ-2026-003", "current_tariff": 2150.00, "readings": [3.0, 3.5, 4.05, 4.60]},
        ],
    },
    {
        "username": "Иванова",
        "email": "ivanova@samara.ru",
        "password": "user1234",
        "street": "ул. Чапаевская",
        "house": "178",
        "apartment": "33",
        "floor": "5",
        "monthly_budget": 5200.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-004", "current_tariff": 5.73, "readings": [11200, 11480, 11790, 12120]},
            {"service_type_id": 1, "serial_number": "ХВ-2026-004", "current_tariff": 42.30, "readings": [310, 322, 335, 348]},
        ],
    },
    {
        "username": "Волков",
        "email": "volkov@samara.ru",
        "password": "user1234",
        "street": "проспект Кирова",
        "house": "56",
        "apartment": "8",
        "floor": "3",
        "monthly_budget": 3500.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-005", "current_tariff": 5.73, "readings": [8600, 8840, 9100, 9380]},
            {"service_type_id": 4, "serial_number": "ГЗ-2026-005", "current_tariff": 8.10, "readings": [420, 435, 452, 470]},
        ],
    },
    {
        "username": "Орлова",
        "email": "orlova@samara.ru",
        "password": "user1234",
        "street": "Московское шоссе",
        "house": "12",
        "apartment": "102",
        "floor": "9",
        "monthly_budget": 4800.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-006", "current_tariff": 5.73, "readings": [15400, 15720, 16080, 16450]},
            {"service_type_id": 2, "serial_number": "ГВ-2026-006", "current_tariff": 165.00, "readings": [88, 94, 101, 108]},
        ],
    },
    {
        "username": "Морозов",
        "email": "morozov@samara.ru",
        "password": "user1234",
        "street": "ул. Красноглинская",
        "house": "37",
        "apartment": "6",
        "floor": "1",
        "monthly_budget": 3100.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-007", "current_tariff": 5.73, "readings": [6400, 6620, 6860, 7120]},
            {"service_type_id": 5, "serial_number": "ОТ-2026-007", "current_tariff": 2150.00, "readings": [2.1, 2.6, 3.0, 3.5]},
        ],
    },
    {
        "username": "Фёдорова",
        "email": "fedorova@samara.ru",
        "password": "user1234",
        "street": "ул. Самарская",
        "house": "243",
        "apartment": "19",
        "floor": "4",
        "monthly_budget": 4500.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-008", "current_tariff": 5.73, "readings": [10100, 10340, 10610, 10900]},
            {"service_type_id": 1, "serial_number": "ХВ-2026-008", "current_tariff": 42.30, "readings": [175, 186, 198, 210]},
            {"service_type_id": 2, "serial_number": "ГВ-2026-008", "current_tariff": 165.00, "readings": [95, 101, 108, 115]},
        ],
    },
    {
        "username": "Никитин",
        "email": "nikitin@samara.ru",
        "password": "user1234",
        "street": "ул. Гагарина",
        "house": "85",
        "apartment": "27",
        "floor": "6",
        "monthly_budget": 3900.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-009", "current_tariff": 5.73, "readings": [9200, 9460, 9740, 10030]},
            {"service_type_id": 4, "serial_number": "ГЗ-2026-009", "current_tariff": 8.10, "readings": [610, 628, 648, 670]},
        ],
    },
    {
        "username": "Соколова",
        "email": "sokolova@samara.ru",
        "password": "user1234",
        "street": "ул. Революционная",
        "house": "152",
        "apartment": "51",
        "floor": "8",
        "monthly_budget": 5500.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-010", "current_tariff": 5.73, "readings": [13800, 14120, 14480, 14860]},
            {"service_type_id": 1, "serial_number": "ХВ-2026-010", "current_tariff": 42.30, "readings": [260, 272, 285, 299]},
            {"service_type_id": 5, "serial_number": "ОТ-2026-010", "current_tariff": 2150.00, "readings": [2.8, 3.2, 3.7, 4.1]},
        ],
    },
]


def build_reading_dates() -> list[datetime]:
    now = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)

    def first_of_prev_month(base: datetime, months_back: int) -> datetime:
        year = base.year
        month = base.month - months_back
        while month <= 0:
            month += 12
            year -= 1
        return datetime(year, month, 1, 12, 0, 0)

    return [
        first_of_prev_month(now, 3),
        first_of_prev_month(now, 2),
        first_of_prev_month(now, 1),
        now,
    ]


def seed_database() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(ServiceType).count() == 0:
            db.add_all([ServiceType(name=item["name"], unit=item["unit"]) for item in INITIAL_SERVICES])
            db.commit()

        if not db.query(User).filter(User.username == "Админ").first():
            db.add(User(
                username="Админ",
                email="admin@samara.ru",
                hashed_password=get_password_hash("admin1234"),
                street="ул. Галактионовская",
                house="141",
                apartment="1",
                floor="1",
                monthly_budget=0.0,
                is_admin=True,
            ))
            db.commit()

        dates = build_reading_dates()
        for demo in DEMO_USERS:
            if db.query(User).filter(User.email == demo["email"]).first():
                continue

            user = User(
                username=demo["username"],
                email=demo["email"],
                hashed_password=get_password_hash(demo["password"]),
                street=demo["street"],
                house=demo["house"],
                apartment=demo["apartment"],
                floor=demo["floor"],
                monthly_budget=demo["monthly_budget"],
                is_admin=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            for meter_data in demo["meters"]:
                meter = Meter(
                    user_id=user.id,
                    service_type_id=meter_data["service_type_id"],
                    serial_number=meter_data["serial_number"],
                    current_tariff=meter_data["current_tariff"],
                )
                db.add(meter)
                db.commit()
                db.refresh(meter)

                previous = None
                for index, value in enumerate(meter_data["readings"]):
                    volume = 0.0 if previous is None else round(value - previous, 4)
                    cost = round(volume * meter_data["current_tariff"], 2)
                    db.add(MeterReading(
                        meter_id=meter.id,
                        reading_value=value,
                        consumed_volume=volume,
                        calculated_cost=cost,
                        recorded_at=dates[index],
                    ))
                    previous = value
                db.commit()
    finally:
        db.close()
