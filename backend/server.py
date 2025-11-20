from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import pandas as pd
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "seller"  # seller or admin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "seller"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class PriceVolume(BaseModel):
    quantity_min: int
    total_price: float
    unit_price: float

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sku: str
    barcode: str
    regular_price: float
    category: str
    stock: int
    min_stock: int
    volume_pricing_enabled: bool = False
    volume_prices: List[PriceVolume] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    sku: str
    barcode: str
    regular_price: float
    category: str
    stock: int
    min_stock: int
    volume_pricing_enabled: bool = False
    volume_prices: List[PriceVolume] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    regular_price: Optional[float] = None
    category: Optional[str] = None
    stock: Optional[int] = None
    min_stock: Optional[int] = None
    volume_pricing_enabled: Optional[bool] = None
    volume_prices: Optional[List[PriceVolume]] = None

class SaleItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    total_price: float
    regular_price: float
    savings: float
    promotion_applied: bool

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[SaleItem]
    total_amount: float
    total_savings: float
    seller_id: str
    seller_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaleCreate(BaseModel):
    items: List[SaleItem]
    total_amount: float
    total_savings: float

# Auth helpers
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Helper function to calculate best price
def calculate_best_price(quantity: int, product: Product):
    if not product.volume_pricing_enabled or not product.volume_prices:
        return {
            "total_price": quantity * product.regular_price,
            "unit_price": product.regular_price,
            "savings": 0,
            "promotion_applied": False
        }
    
    # Sort volume prices by quantity descending
    sorted_prices = sorted(product.volume_prices, key=lambda x: x.quantity_min, reverse=True)
    
    # Find applicable promotion
    for price_tier in sorted_prices:
        if quantity >= price_tier.quantity_min:
            total = price_tier.total_price * (quantity // price_tier.quantity_min)
            remaining = quantity % price_tier.quantity_min
            if remaining > 0:
                # Check if remaining units can use a smaller tier
                remaining_price = remaining * product.regular_price
                for tier in reversed(sorted_prices):
                    if remaining >= tier.quantity_min:
                        remaining_price = tier.total_price * (remaining // tier.quantity_min)
                        remaining_price += (remaining % tier.quantity_min) * product.regular_price
                        break
                total += remaining_price
            
            regular_total = quantity * product.regular_price
            return {
                "total_price": total,
                "unit_price": total / quantity,
                "savings": regular_total - total,
                "promotion_applied": True
            }
    
    # No promotion applies
    return {
        "total_price": quantity * product.regular_price,
        "unit_price": product.regular_price,
        "savings": 0,
        "promotion_applied": False
    }

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_data.model_dump(exclude={"password"})
    user = User(**user_dict)
    
    doc = user.model_dump()
    doc['password'] = hash_password(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(login_data.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if isinstance(user['created_at'], str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    user_obj = User(**{k: v for k, v in user.items() if k != 'password'})
    access_token = create_access_token(data={"sub": user_obj.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

# Product routes
@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    # Check if barcode or SKU exists
    existing = await db.products.find_one({"$or": [{"barcode": product_data.barcode}, {"sku": product_data.sku}]})
    if existing:
        raise HTTPException(status_code=400, detail="Product with this barcode or SKU already exists")
    
    product = Product(**product_data.model_dump())
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.products.insert_one(doc)
    return product

@api_router.get("/products", response_model=List[Product])
async def get_products(current_user: User = Depends(get_current_user)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    for product in products:
        if isinstance(product['created_at'], str):
            product['created_at'] = datetime.fromisoformat(product['created_at'])
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product['created_at'], str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)

@api_router.get("/products/barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(barcode: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product['created_at'], str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductUpdate, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in product_data.model_dump(exclude_unset=True).items() if v is not None}
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(updated_product['created_at'], str):
        updated_product['created_at'] = datetime.fromisoformat(updated_product['created_at'])
    return Product(**updated_product)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

@api_router.post("/products/calculate-price")
async def calculate_price(product_id: str, quantity: int, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if isinstance(product['created_at'], str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    
    product_obj = Product(**product)
    pricing = calculate_best_price(quantity, product_obj)
    
    return pricing

# Sales routes
@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    sale = Sale(
        **sale_data.model_dump(),
        seller_id=current_user.id,
        seller_name=current_user.name
    )
    
    # Update stock
    for item in sale.items:
        product = await db.products.find_one({"id": item.product_id})
        if product:
            new_stock = product['stock'] - item.quantity
            await db.products.update_one({"id": item.product_id}, {"$set": {"stock": new_stock}})
    
    doc = sale.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.sales.insert_one(doc)
    return sale

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: User = Depends(get_current_user)):
    sales = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for sale in sales:
        if isinstance(sale['created_at'], str):
            sale['created_at'] = datetime.fromisoformat(sale['created_at'])
    return sales

@api_router.get("/sales/{sale_id}", response_model=Sale)
async def get_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if isinstance(sale['created_at'], str):
        sale['created_at'] = datetime.fromisoformat(sale['created_at'])
    return Sale(**sale)

# Reports routes
@api_router.get("/reports/sales")
async def get_sales_report(start_date: str, end_date: str, current_user: User = Depends(get_current_user)):
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
        
        # Ensure timezone consistency
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format")
    
    # Get sales in range
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    
    filtered_sales = []
    for sale in sales:
        sale_date = datetime.fromisoformat(sale['created_at']) if isinstance(sale['created_at'], str) else sale['created_at']
        
        # Ensure timezone consistency for comparison
        if sale_date.tzinfo is None:
            sale_date = sale_date.replace(tzinfo=timezone.utc)
            
        if start <= sale_date <= end:
            sale['created_at'] = sale_date
            filtered_sales.append(sale)
    
    total_sales = len(filtered_sales)
    total_revenue = sum(s['total_amount'] for s in filtered_sales)
    total_savings = sum(s['total_savings'] for s in filtered_sales)
    
    # Products breakdown
    products_sold = {}
    promotion_sales = 0
    regular_sales = 0
    
    for sale in filtered_sales:
        for item in sale['items']:
            if item['product_id'] not in products_sold:
                products_sold[item['product_id']] = {
                    "product_name": item['product_name'],
                    "quantity": 0,
                    "revenue": 0,
                    "promotion_count": 0,
                    "regular_count": 0
                }
            products_sold[item['product_id']]['quantity'] += item['quantity']
            products_sold[item['product_id']]['revenue'] += item['total_price']
            if item['promotion_applied']:
                products_sold[item['product_id']]['promotion_count'] += 1
                promotion_sales += 1
            else:
                products_sold[item['product_id']]['regular_count'] += 1
                regular_sales += 1
    
    top_products = sorted(products_sold.values(), key=lambda x: x['quantity'], reverse=True)[:10]
    
    return {
        "summary": {
            "total_sales": total_sales,
            "total_revenue": total_revenue,
            "total_savings": total_savings,
            "promotion_sales": promotion_sales,
            "regular_sales": regular_sales
        },
        "top_products": top_products,
        "sales": filtered_sales
    }

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    # Get today's sales
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    all_sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    today_sales = []
    for sale in all_sales:
        sale_date = datetime.fromisoformat(sale['created_at']) if isinstance(sale['created_at'], str) else sale['created_at']
        if sale_date >= today:
            today_sales.append(sale)
    
    today_revenue = sum(s['total_amount'] for s in today_sales)
    today_count = len(today_sales)
    
    # Get low stock products
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    low_stock = [p for p in products if p['stock'] <= p['min_stock']]
    
    return {
        "today_sales_count": today_count,
        "today_revenue": today_revenue,
        "low_stock_count": len(low_stock),
        "low_stock_products": low_stock[:5],
        "total_products": len(products)
    }

@api_router.get("/reports/export-excel")
async def export_sales_to_excel(start_date: str, end_date: str, current_user: User = Depends(get_current_user)):
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
        
        # Ensure timezone consistency
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format")
    
    # Get sales in range
    all_sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    
    filtered_sales = []
    for sale in all_sales:
        sale_date = datetime.fromisoformat(sale['created_at']) if isinstance(sale['created_at'], str) else sale['created_at']
        
        # Ensure timezone consistency for comparison
        if sale_date.tzinfo is None:
            sale_date = sale_date.replace(tzinfo=timezone.utc)
            
        if start <= sale_date <= end:
            sale['created_at'] = sale_date
            filtered_sales.append(sale)
    
    # Create Excel file
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: Summary
        summary_data = {
            'Métrica': ['Total Ventas', 'Ingresos Totales', 'Ahorros Totales'],
            'Valor': [
                len(filtered_sales),
                sum(s['total_amount'] for s in filtered_sales),
                sum(s['total_savings'] for s in filtered_sales)
            ]
        }
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Resumen', index=False)
        
        # Sheet 2: Sales Details
        sales_rows = []
        for sale in filtered_sales:
            for item in sale['items']:
                sales_rows.append({
                    'Fecha': sale['created_at'].strftime('%Y-%m-%d %H:%M:%S'),
                    'ID Venta': sale['id'],
                    'Vendedor': sale['seller_name'],
                    'Producto': item['product_name'],
                    'Cantidad': item['quantity'],
                    'Precio Unitario': item['unit_price'],
                    'Total': item['total_price'],
                    'Precio Regular': item['regular_price'],
                    'Ahorro': item['savings'],
                    'Promoción Aplicada': 'Sí' if item['promotion_applied'] else 'No'
                })
        
        if sales_rows:
            df_sales = pd.DataFrame(sales_rows)
            df_sales.to_excel(writer, sheet_name='Ventas Detalladas', index=False)
        
        # Sheet 3: Products Summary
        products_sold = {}
        for sale in filtered_sales:
            for item in sale['items']:
                if item['product_name'] not in products_sold:
                    products_sold[item['product_name']] = {
                        'Producto': item['product_name'],
                        'Cantidad Total': 0,
                        'Ingresos': 0,
                        'Ventas con Promoción': 0,
                        'Ventas Regulares': 0,
                        'Ahorro Total': 0
                    }
                products_sold[item['product_name']]['Cantidad Total'] += item['quantity']
                products_sold[item['product_name']]['Ingresos'] += item['total_price']
                products_sold[item['product_name']]['Ahorro Total'] += item['savings']
                if item['promotion_applied']:
                    products_sold[item['product_name']]['Ventas con Promoción'] += 1
                else:
                    products_sold[item['product_name']]['Ventas Regulares'] += 1
        
        if products_sold:
            df_products = pd.DataFrame(list(products_sold.values()))
            df_products = df_products.sort_values('Cantidad Total', ascending=False)
            df_products.to_excel(writer, sheet_name='Productos', index=False)
    
    output.seek(0)
    
    filename = f"reporte_ventas_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/")
async def root():
    return {"message": "POS API is running"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
