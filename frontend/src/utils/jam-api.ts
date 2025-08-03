import axios from 'axios';

export interface ICompany {
    id: number;
    company_name: string;
    liked: boolean;
}

export interface ICollection {
    id: string;
    collection_name: string;
    companies: ICompany[];
    total: number;
}

export interface ICompanyBatchResponse {
    companies: ICompany[];
}

export interface ICursorPaginatedResponse {
    companies: ICompany[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number;
}

export interface ISelectAllCompaniesResponse {
    company_ids: number[];
    total_count: number;
}

export interface IBatchJobRequest {
    source_collection_id: string;
    target_collection_id: string;
    company_ids: number[];
}

export interface IBatchDeleteRequest {
    collection_id: string;
    company_ids: number[];
}

export interface IBatchJobResponse {
    job_id: string;
    status: string;
    job_type: string;
    total_count: number;
    processed_count: number;
    created_at: string;
    updated_at: string;
    error_message?: string;
}

export interface ICreateCollectionRequest {
    collection_name: string;
}

export interface ICreateCollectionResponse {
    id: string;
    collection_name: string;
    message: string;
}

const BASE_URL = 'http://localhost:8000';

export async function getCompanies(offset?: number, limit?: number): Promise<ICompanyBatchResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/companies`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsById(id: string, offset?: number, limit?: number): Promise<ICollection> {
    try {
        const response = await axios.get(`${BASE_URL}/collections/${id}`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsMetadata(): Promise<ICollection[]> {
    try {
        const response = await axios.get(`${BASE_URL}/collections`);
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionCompaniesCursor(
    collectionId: string, 
    cursor?: string, 
    limit: number = 100
): Promise<ICursorPaginatedResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/collections/${collectionId}/companies/cursor`, {
            params: {
                cursor,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies with cursor:', error);
        throw error;
    }
}

export async function getAllCompanyIdsInCollection(collectionId: string): Promise<ISelectAllCompaniesResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/collections/${collectionId}/companies/all-ids`);
        return response.data;
    } catch (error) {
        console.error('Error fetching all company IDs:', error);
        throw error;
    }
}

export async function createBatchAddJob(request: IBatchJobRequest): Promise<IBatchJobResponse> {
    try {
        const response = await axios.post(`${BASE_URL}/batch/add-companies`, request);
        return response.data;
    } catch (error) {
        console.error('Error creating batch add job:', error);
        throw error;
    }
}

export async function getBatchJobStatus(jobId: string): Promise<IBatchJobResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/batch/jobs/${jobId}/status`);
        return response.data;
    } catch (error) {
        console.error('Error fetching batch job status:', error);
        throw error;
    }
}

export async function cancelBatchJob(jobId: string): Promise<{ message: string }> {
    try {
        const response = await axios.post(`${BASE_URL}/batch/jobs/${jobId}/cancel`);
        return response.data;
    } catch (error) {
        console.error('Error cancelling batch job:', error);
        throw error;
    }
}

export async function createBatchDeleteJob(request: IBatchDeleteRequest): Promise<IBatchJobResponse> {
    try {
        const response = await axios.post(`${BASE_URL}/batch/delete-companies`, request);
        return response.data;
    } catch (error) {
        console.error('Error creating batch delete job:', error);
        throw error;
    }
}

export async function createCollection(request: ICreateCollectionRequest): Promise<ICreateCollectionResponse> {
    try {
        const response = await axios.post(`${BASE_URL}/collections`, request);
        return response.data;
    } catch (error) {
        console.error('Error creating collection:', error);
        throw error;
    }
}