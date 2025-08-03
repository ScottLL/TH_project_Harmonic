import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    CompanyOutput,
    fetch_companies_with_liked,
)

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


class CompanyCollectionMetadata(BaseModel):
    id: uuid.UUID
    collection_name: str


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass


class CursorPaginatedResponse(BaseModel):
    companies: List[CompanyOutput]
    next_cursor: Optional[str] = None
    has_more: bool = False
    total_count: int = 0


class SelectAllCompaniesResponse(BaseModel):
    company_ids: List[int]
    total_count: int


class CreateCollectionRequest(BaseModel):
    collection_name: str


class CreateCollectionResponse(BaseModel):
    id: uuid.UUID
    collection_name: str
    message: str


@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
        )
        for collection in collections
    ]


@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
    )

    total_count = query.with_entities(func.count()).scalar()

    results = query.offset(offset).limit(limit).all()
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection)
        .get(collection_id)
        .collection_name,
        companies=companies,
        total=total_count,
    )


@router.get("/{collection_id}/companies/cursor", response_model=CursorPaginatedResponse)
def get_collection_companies_cursor(
    collection_id: uuid.UUID,
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: int = Query(100, description="Number of items to fetch", le=1000),
    db: Session = Depends(database.get_db),
):
    """Get companies from a collection using cursor-based pagination"""
    
    # Verify collection exists
    collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == collection_id
    ).first()
    
    if not collection:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Build base query
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
        .order_by(database.Company.id)  # Use company ID for consistent ordering
    )
    
    # Apply cursor filtering if provided
    if cursor:
        try:
            cursor_id = int(cursor)
            query = query.filter(database.Company.id > cursor_id)
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid cursor format")
    
    # Get total count (for metadata)
    total_count = (
        db.query(database.CompanyCollectionAssociation)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
        .count()
    )
    
    # Fetch one extra to determine if there are more results
    results = query.limit(limit + 1).all()
    
    # Determine if there are more results and next cursor
    has_more = len(results) > limit
    if has_more:
        results = results[:limit]  # Remove the extra item
        next_cursor = str(results[-1][1].id) if results else None
    else:
        next_cursor = None
    
    # Fetch company data with liked status
    company_ids = [company.id for _, company in results]
    companies = fetch_companies_with_liked(db, company_ids)
    
    return CursorPaginatedResponse(
        companies=companies,
        next_cursor=next_cursor,
        has_more=has_more,
        total_count=total_count
    )


@router.get("/{collection_id}/companies/all-ids", response_model=SelectAllCompaniesResponse)
def get_all_company_ids_in_collection(
    collection_id: uuid.UUID,
    db: Session = Depends(database.get_db),
):
    """Get all company IDs in a collection for select-all functionality"""
    
    # Verify collection exists
    collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == collection_id
    ).first()
    
    if not collection:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Get all company IDs in the collection
    company_associations = (
        db.query(database.CompanyCollectionAssociation.company_id)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
        .order_by(database.CompanyCollectionAssociation.company_id)
        .all()
    )
    
    company_ids = [assoc.company_id for assoc in company_associations]
    
    return SelectAllCompaniesResponse(
        company_ids=company_ids,
        total_count=len(company_ids)
    )


@router.post("", response_model=CreateCollectionResponse)
def create_collection(
    request: CreateCollectionRequest,
    db: Session = Depends(database.get_db),
):
    """Create a new collection"""
    
    # Check if collection name already exists
    existing = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.collection_name == request.collection_name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Collection name already exists")
    
    # Create new collection
    new_collection = database.CompanyCollection(
        collection_name=request.collection_name
    )
    
    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)
    
    return CreateCollectionResponse(
        id=new_collection.id,
        collection_name=new_collection.collection_name,
        message="Collection created successfully"
    )


class DeleteCollectionResponse(BaseModel):
    message: str


@router.delete("/{collection_id}", response_model=DeleteCollectionResponse)
def delete_collection(
    collection_id: uuid.UUID,
    db: Session = Depends(database.get_db),
):
    """Delete a collection and all its associations"""
    
    # Find the collection
    collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == collection_id
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Prevent deletion of "My List" collection
    if collection.collection_name == "My List":
        raise HTTPException(status_code=400, detail="Cannot delete the 'My List' collection")
    
    # Delete related batch jobs first (both as source and target collection)
    db.query(database.BatchJob).filter(
        or_(
            database.BatchJob.source_collection_id == collection_id,
            database.BatchJob.target_collection_id == collection_id
        )
    ).delete()
    
    # Delete all company-collection associations
    db.query(database.CompanyCollectionAssociation).filter(
        database.CompanyCollectionAssociation.collection_id == collection_id
    ).delete()
    
    # Delete the collection itself
    db.delete(collection)
    db.commit()
    
    return DeleteCollectionResponse(
        message=f"Collection '{collection.collection_name}' deleted successfully"
    )
