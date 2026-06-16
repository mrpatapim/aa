from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.config import attach_auth_cookie, clear_auth_cookie
from app.database import get_db
from app.models.users import User
from app.schemas.users import UserCreate, UserOut, BudgetUpdate
from app.districts import match_street
from app.security import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(tags=["Authentication"])

@router.post("/register")
def register_user(user: UserCreate, response: Response, db: Session = Depends(get_db)):
    db_user_email = db.query(User).filter(User.email == user.email).first()
    if db_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user_username = db.query(User).filter(User.username == user.username).first()
    if db_user_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    matched_street = match_street(user.street)
    if not matched_street:
        raise HTTPException(
            status_code=400,
            detail="Укажите улицу из подсказок Самары (начните вводить название и выберите вариант из списка)",
        )

    house = user.house.strip()
    if not house or not house[0].isdigit():
        raise HTTPException(status_code=400, detail="Номер дома должен начинаться с цифры")

    hashed_pwd = get_password_hash(user.password)
    
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pwd,
        street=matched_street["label"],
        house=house,
        apartment=user.apartment,
        floor=user.floor,
        monthly_budget=0.0,
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.username})
    attach_auth_cookie(response, access_token)
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "is_admin": new_user.is_admin
    }

@router.post("/login")
def login_user(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    attach_auth_cookie(response, access_token)
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "is_admin": user.is_admin
    }

@router.post("/logout")
def logout_user(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}

@router.get("/users/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/users/me/budget", response_model=UserOut)
def update_user_budget(budget_data: BudgetUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.monthly_budget = budget_data.budget
    db.commit()
    db.refresh(current_user)
    return current_user