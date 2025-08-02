from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db import database

router = APIRouter(
    prefix="/companies",
    tags=["companies"],
)


class CompanyOutput(BaseModel):
    id: int
    company_name: str
    liked: bool


class CompanyBatchOutput(BaseModel):
    companies: list[CompanyOutput]
    total: int


def fetch_companies_with_liked(
    db: Session, company_ids: list[int]
) -> list[CompanyOutput]:
    liked_list = (
        db.query(database.CompanyCollection)
        .filter(database.CompanyCollection.collection_name == "Liked Companies List")
        .first()
    )

    liked_associations = (
        db.query(database.CompanyCollectionAssociation)
        .filter(database.Company.id.in_(company_ids))
        .filter(
            database.CompanyCollectionAssociation.collection_id == liked_list.id,
        )
        .all()
    )

    liked_companies = {association.company_id for association in liked_associations}

    companies = (
        db.query(database.Company).filter(database.Company.id.in_(company_ids)).all()
    )

    results = [(company, company.id in liked_companies) for company in companies]

    return [
        CompanyOutput(
            id=company.id,
            company_name=company.company_name,
            liked=True if liked else False,
        )
        for company, liked in results
    ]


@router.get("", response_model=CompanyBatchOutput)
def get_companies(
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    results = db.query(database.Company).offset(offset).limit(limit).all()

    count = db.query(database.Company).count()
    companies = fetch_companies_with_liked(db, [company.id for company in results])

    return CompanyBatchOutput(
        companies=companies,
        total=count,
    )
