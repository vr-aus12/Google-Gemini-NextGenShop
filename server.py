from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import sqlite3
import json
import uuid
from datetime import datetime
from passlib.context import CryptContext

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE = 'marketplace.db'
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuth(BaseModel):
    token: str
    email: str
    name: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    cardNumber: Optional[str] = None
    cardExpiry: Optional[str] = None
    cardCvv: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    order_id: str
    status: str

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            rating REAL,
            specs TEXT,
            seller_id TEXT,
            seller_name TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT,
            address TEXT,
            cardNumber TEXT,
            cardExpiry TEXT,
            cardCvv TEXT,
            isVerified INTEGER DEFAULT 0,
            verificationToken TEXT
        )
    ''')
    
    cursor.execute('CREATE TABLE IF NOT EXISTS cart (user_id TEXT, product_id TEXT, quantity INTEGER, PRIMARY KEY (user_id, product_id))')
    cursor.execute('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT, date TEXT, total REAL, status TEXT, shipping_address TEXT, payment_method TEXT, items TEXT)')
    cursor.execute('CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT, user_id TEXT, user_name TEXT, rating INTEGER, comment TEXT, date TEXT)')

    # Seed products if empty
    cursor.execute('SELECT COUNT(*) FROM products')
    if cursor.fetchone()[0] == 0:
        dummy_products = [
            ('1', 'Mechanical Gaming Keyboard', 'Ultra-responsive RGB mechanical keyboard.', 129.99, 'Gaming', 'https://picsum.photos/seed/keyboard/400/400', 4.8, json.dumps(['RGB Lighting', 'Tactile Brown Switches']), 's1', 'Gaming Central'),
            ('2', 'Logitech G Pro Wireless', 'Esports pro mouse.', 99.99, 'Gaming', 'https://picsum.photos/seed/mouse/400/400', 4.9, json.dumps(['Lightspeed Wireless', 'HERO 25K Sensor']), 's2', 'ProGear'),
            ('3', 'Sony WH-1000XM5', 'Noise canceling headphones.', 348.00, 'Audio', 'https://picsum.photos/seed/headphones/400/400', 4.7, json.dumps(['30h Battery', 'LDAC']), 's3', 'Audio Hub'),
            ('4', 'Ergonomic Office Chair', 'Premium mesh chair.', 499.00, 'Workstation', 'https://picsum.photos/seed/chair/400/400', 4.6, json.dumps(['Adjustable Lumbar', '4D Armrests']), 's4', 'Office Pro')
        ]
        cursor.executemany('INSERT INTO products (id, name, description, price, category, image, rating, specs, seller_id, seller_name) VALUES (?,?,?,?,?,?,?,?,?,?)', dummy_products)

    conn.commit()
    conn.close()

init_db()

@app.post("/register")
async def register(user: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(user.password)
    verification_token = str(uuid.uuid4()[:8]) # Short token for easier manual entry
    
    cursor.execute('''
        INSERT INTO users (id, name, email, password_hash, role, isVerified, verificationToken)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, user.name, user.email, password_hash, 'buyer', 0, verification_token))
    db.commit()
    
    return {"status": "success", "message": "Check your email for verification link", "token": verification_token}

@app.post("/login")
async def login(credentials: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (credentials.email,))
    user = cursor.fetchone()
    if not user or not pwd_context.verify(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_dict = dict(user)
    if 'password_hash' in user_dict: del user_dict['password_hash']
    return user_dict

@app.get("/verify-email/{token}")
async def verify_email(token: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM users WHERE verificationToken = ?", (token,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    cursor.execute("UPDATE users SET isVerified = 1, verificationToken = NULL WHERE id = ?", (user['id'],))
    db.commit()
    return {"status": "success", "message": "Email verified successfully"}

@app.post("/auth/google")
async def google_auth(auth: GoogleAuth, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (auth.email,))
    user = cursor.fetchone()
    
    if not user:
        user_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO users (id, name, email, role, isVerified)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, auth.name, auth.email, 'buyer', 1))
        db.commit()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
    
    user_dict = dict(user)
    if 'password_hash' in user_dict: del user_dict['password_hash']
    return user_dict

@app.get("/products")
async def get_products(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM products ORDER BY id DESC")
    return [dict(row) for row in cursor.fetchall()]

@app.get("/user/{user_id}")
async def get_profile(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if row:
        d = dict(row)
        if 'password_hash' in d: del d['password_hash']
        return d
    raise HTTPException(status_code=404, detail="User not found")

@app.post("/user/{user_id}")
async def update_profile(user_id: str, profile: ProfileUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute('''
        UPDATE users SET name = COALESCE(?, name), address = COALESCE(?, address), 
        cardNumber = COALESCE(?, cardNumber), cardExpiry = COALESCE(?, cardExpiry), cardCvv = COALESCE(?, cardCvv)
        WHERE id = ?
    ''', (profile.name, profile.address, profile.cardNumber, profile.cardExpiry, profile.cardCvv, user_id))
    db.commit()
    return {"status": "success"}

@app.get("/cart/{user_id}")
async def get_cart(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute('''
        SELECT p.*, c.quantity 
        FROM cart c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    return [{"product": dict(r), "quantity": r['quantity']} for r in rows]

@app.post("/cart")
async def add_to_cart(data: dict, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("INSERT OR REPLACE INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)", 
                  (data['user_id'], data['product_id'], data['quantity']))
    db.commit()
    return {"status": "success"}

@app.delete("/cart/{user_id}")
async def clear_cart(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM cart WHERE user_id = ?", (user_id,))
    db.commit()
    return {"status": "success"}

@app.post("/checkout")
async def checkout(req: dict, db: sqlite3.Connection = Depends(get_db)):
    # Simple order tracking simulation
    order_id = str(uuid.uuid4())
    return {"status": "success", "order_id": order_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)