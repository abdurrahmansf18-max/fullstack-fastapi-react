import uuid
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, model_validator, HttpUrl

# ---- Auth/Admin ----
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class AdminInitIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)

class AdminCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)

class AdminOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    created_at: datetime

class AdminPasswordIn(BaseModel):
    password: str = Field(min_length=8, max_length=200)

# ---- Category ----
class CategoryBase(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0  # CREATE için default

class CategoryCreate(CategoryBase):
    name: str

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None  # UPDATE'te None

class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime

# ---- Heading ----
class HeadingBase(BaseModel):
    level: Optional[int] = None  # 1 or 2
    category_id: Optional[uuid.UUID] = None
    parent_heading_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0

class HeadingCreate(HeadingBase):
    level: int
    title: str

    @model_validator(mode="after")
    def validate_scope(self):
        if self.level not in (1, 2):
            raise ValueError("level 1 veya 2 olmalı")
        if self.level == 1:
            if self.category_id is None:
                raise ValueError("level=1 için category_id zorunlu")
            if self.parent_heading_id is not None:
                raise ValueError("level=1 için parent_heading_id gönderme")
        if self.level == 2:
            if self.parent_heading_id is None:
                raise ValueError("level=2 için parent_heading_id zorunlu")
            if self.category_id is not None:
                raise ValueError("level=2 için category_id gönderme")
        return self

class HeadingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None  # UPDATE'te None

class HeadingOut(BaseModel):
    id: uuid.UUID
    level: int
    category_id: Optional[uuid.UUID]
    parent_heading_id: Optional[uuid.UUID]
    title: str
    slug: str
    description: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime

# ---- Content ----
class ContentBase(BaseModel):
    heading_id: Optional[uuid.UUID] = None
    body: Optional[str] = None
    description: Optional[str] = None

class ContentCreate(ContentBase):
    heading_id: uuid.UUID
    body: str

class ContentUpdate(ContentBase):
    body: Optional[str] = None
    description: Optional[str] = None

class ContentOut(BaseModel):
    id: uuid.UUID
    heading_id: uuid.UUID
    body: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

# ---- Content Image ----
class ContentImageBase(BaseModel):
    url: Optional[str] = None
    alt: Optional[str] = ""
    sort_order: Optional[int] = 0
    width: Optional[int] = None    # yeni eklendi
    height: Optional[int] = None    # yeni eklendi


class ContentImageCreate(ContentImageBase):
    content_id: uuid.UUID
    url: str


class ContentImageUpdate(BaseModel):
    url: Optional[str] = None
    alt: Optional[str] = None
    sort_order: Optional[int] = None
    width: Optional[int] = None     # yeni eklendi
    height: Optional[int] = None    # yeni eklendi


class ContentImageOut(BaseModel):
    id: uuid.UUID
    content_id: uuid.UUID
    url: str
    alt: str
    sort_order: int
    width: Optional[int] = 300
    height: Optional[int] = 200                   # yeni eklendi
    created_at: datetime
    updated_at: datetime


# ---- Public/View ----
class ContentPublic(BaseModel):
    id: UUID
    heading_id: UUID
    body: str
    description: Optional[str] = None

class CategoryPublic(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    sort_order: int

class HeadingPublic(BaseModel):
    id: uuid.UUID
    level: int
    title: str
    slug: str
    sort_order: int

class PageOut(BaseModel):
    category: str
    h1: str
    h2: str
    title: str
    body: str

from pydantic import Field as PydField

class MenuNode(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    sort_order: int
    children: List["MenuNode"] = PydField(default_factory=list)

MenuNode.model_rebuild()

# ---- Search ----
class SearchResult(BaseModel):
    source: str
    id: uuid.UUID
    label: Optional[str] = None
    snippet: Optional[str] = None
    score: float

class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
    total_count: int