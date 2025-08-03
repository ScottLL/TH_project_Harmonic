import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.db import database
from backend.db.database import BatchJobStatus, BatchJobType

router = APIRouter(
    prefix="/batch",
    tags=["batch-operations"],
)


class BatchAddRequest(BaseModel):
    source_collection_id: uuid.UUID
    target_collection_id: uuid.UUID
    company_ids: List[int]


class BatchDeleteRequest(BaseModel):
    collection_id: uuid.UUID
    company_ids: List[int]


class BatchJobResponse(BaseModel):
    job_id: uuid.UUID
    status: str
    job_type: str
    total_count: int
    processed_count: int
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


def process_batch_job(job_id: uuid.UUID, db_url: str):
    """Background task to process batch job (ADD or DELETE)"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Get the job
        job = db.query(database.BatchJob).filter(database.BatchJob.id == job_id).first()
        if not job:
            return
        
        # Check if job was cancelled before we started
        if job.status == BatchJobStatus.CANCELLED:
            print(f"Job {job_id} was cancelled before processing started")
            return
        
        # Update job status to IN_PROGRESS
        job.status = BatchJobStatus.IN_PROGRESS
        db.commit()
        
        # Parse company IDs from JSON
        company_ids = json.loads(job.company_ids_json)
        
        # Hybrid approach: individual processing for small operations, small batches for large ones
        total_items = len(company_ids)
        
        if total_items <= 100:
            # For small operations: process individually for 1, 2, 3, 4... progress
            batch_size = 1
        else:
            # For large operations: use small batches for reasonable performance
            batch_size = 5  # Process 5 at a time for progress: 5, 10, 15, 20...
        
        processed = 0
        
        # Process in batches
        for i in range(0, len(company_ids), batch_size):
            # Check if job has been cancelled
            db.refresh(job)
            if job.status == BatchJobStatus.CANCELLED:
                print(f"Job {job_id} cancelled by user, stopping processing")
                return
            
            batch_ids = company_ids[i:i + batch_size]
            
            if job.job_type == BatchJobType.ADD:
                # ADD operation - prepare associations for this batch
                associations_to_add = []
                for company_id in batch_ids:
                    # Check if association already exists
                    existing = db.query(database.CompanyCollectionAssociation).filter(
                        and_(
                            database.CompanyCollectionAssociation.company_id == company_id,
                            database.CompanyCollectionAssociation.collection_id == job.target_collection_id
                        )
                    ).first()
                    
                    if not existing:
                        associations_to_add.append(
                            database.CompanyCollectionAssociation(
                                company_id=company_id,
                                collection_id=job.target_collection_id
                            )
                        )
                
                # Bulk insert the batch (triggers throttle once per batch)
                if associations_to_add:
                    db.bulk_save_objects(associations_to_add)
                    db.commit()
                
            elif job.job_type == BatchJobType.DELETE:
                # DELETE operation - delete items in this batch
                for company_id in batch_ids:
                    db.query(database.CompanyCollectionAssociation).filter(
                        and_(
                            database.CompanyCollectionAssociation.company_id == company_id,
                            database.CompanyCollectionAssociation.collection_id == job.source_collection_id
                        )
                    ).delete()
                db.commit()
            
            # Update progress after each batch
            processed += len(batch_ids)
            job.processed_count = processed
            db.commit()
        
        # Final progress update to ensure we reach 100%
        job.processed_count = processed
        db.commit()
        
        # Mark job as completed
        job.status = BatchJobStatus.COMPLETED
        db.commit()
        
    except Exception as e:
        # Mark job as failed
        job.status = BatchJobStatus.FAILED
        job.error_message = str(e)
        db.commit()
        
    finally:
        db.close()


@router.post("/add-companies", response_model=BatchJobResponse)
def create_batch_add_job(
    request: BatchAddRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    """Create a batch job to add companies to a collection"""
    
    # Validate collections exist
    source_collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == request.source_collection_id
    ).first()
    
    target_collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == request.target_collection_id
    ).first()
    
    if not source_collection or not target_collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Create batch job
    job = database.BatchJob(
        job_type=BatchJobType.ADD,
        source_collection_id=request.source_collection_id,
        target_collection_id=request.target_collection_id,
        total_count=len(request.company_ids),
        company_ids_json=json.dumps(request.company_ids)
    )
    
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Start background processing
    background_tasks.add_task(
        process_batch_job, 
        job.id, 
        database.SQLALCHEMY_DATABASE_URL
    )
    
    return BatchJobResponse(
        job_id=job.id,
        status=job.status.value,
        job_type=job.job_type.value,
        total_count=job.total_count,
        processed_count=job.processed_count,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        error_message=job.error_message
    )


@router.get("/jobs/{job_id}/status", response_model=BatchJobResponse)
def get_batch_job_status(
    job_id: uuid.UUID,
    db: Session = Depends(database.get_db)
):
    """Get the status of a batch job"""
    
    job = db.query(database.BatchJob).filter(database.BatchJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return BatchJobResponse(
        job_id=job.id,
        status=job.status.value,
        job_type=job.job_type.value,
        total_count=job.total_count,
        processed_count=job.processed_count,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        error_message=job.error_message
    )


@router.post("/jobs/{job_id}/cancel")
def cancel_batch_job(
    job_id: uuid.UUID,
    db: Session = Depends(database.get_db)
):
    """Cancel a batch job (mark as cancelled, actual cancellation depends on implementation)"""
    
    job = db.query(database.BatchJob).filter(database.BatchJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status in [BatchJobStatus.COMPLETED, BatchJobStatus.FAILED, BatchJobStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled in current status")
    
    job.status = BatchJobStatus.CANCELLED
    db.commit()
    
    return {"message": "Job cancelled successfully"}


@router.post("/delete-companies", response_model=BatchJobResponse)
def create_batch_delete_job(
    request: BatchDeleteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    """Create a batch job to delete companies from a collection"""
    
    # Validate collection exists
    collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == request.collection_id
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Create batch job
    job = database.BatchJob(
        job_type=BatchJobType.DELETE,
        source_collection_id=request.collection_id,
        target_collection_id=None,  # Not needed for delete operations
        total_count=len(request.company_ids),
        company_ids_json=json.dumps(request.company_ids)
    )
    
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Start background processing
    background_tasks.add_task(
        process_batch_job, 
        job.id, 
        database.SQLALCHEMY_DATABASE_URL
    )
    
    return BatchJobResponse(
        job_id=job.id,
        status=job.status.value,
        job_type=job.job_type.value,
        total_count=job.total_count,
        processed_count=job.processed_count,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        error_message=job.error_message
    )