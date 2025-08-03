import { DataGrid, GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Alert,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  getCollectionCompaniesCursor,
  getAllCompanyIdsInCollection,
  getCollectionsMetadata,
  createBatchAddJob,
  createBatchDeleteJob,
  ICompany,
  ICollection,
  ICursorPaginatedResponse,
} from "../utils/jam-api";
import BatchProgressModal from "./BatchProgressModal";
import ActionsDropdown from "./ActionsDropdown";

interface CompanyTableProps {
  selectedCollectionId: string;
}

function CompanyTable({ selectedCollectionId }: CompanyTableProps) {
  // Data states
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [pageSize, setPageSize] = useState(25);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Selection states
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [isSelectAllPages, setIsSelectAllPages] = useState(false);
  const [isSelectCurrentPage, setIsSelectCurrentPage] = useState(false);
  const [allCompanyIds, setAllCompanyIds] = useState<number[]>([]);

  // Batch operation states
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [targetCollectionId, setTargetCollectionId] = useState<string>("");
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [operationType, setOperationType] = useState<'ADD' | 'DELETE'>('ADD');

  // Load collections metadata for target selection
  useEffect(() => {
    getCollectionsMetadata().then(setCollections).catch(console.error);
  }, [selectedCollectionId]); // Refresh collections when selected collection changes

  // Set default target collection (first collection that's not the current one)
  useEffect(() => {
    const availableCollections = collections.filter(c => c.id !== selectedCollectionId);
    if (availableCollections.length > 0) {
      // If no target is selected OR the current target is the same as source, pick a new one
      if (!targetCollectionId || targetCollectionId === selectedCollectionId) {
        setTargetCollectionId(availableCollections[0].id);
      }
      // If current target collection no longer exists, reset to first available
      else if (!collections.find(c => c.id === targetCollectionId)) {
        setTargetCollectionId(availableCollections[0].id);
      }
    }
  }, [collections, selectedCollectionId, targetCollectionId]);

  // Load companies data using cursor pagination
  const loadCompanies = useCallback(async (page: number, resetData: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Calculate cursor based on page
      let currentCursor: string | null = null;
      if (page > 0 && companies.length > 0) {
        // For pagination, use the ID of the last company from previous page
        const lastCompanyId = companies[companies.length - 1]?.id;
        currentCursor = lastCompanyId?.toString() || null;
      }

      const response: ICursorPaginatedResponse = await getCollectionCompaniesCursor(
        selectedCollectionId,
        currentCursor || undefined,
        pageSize
      );

      if (resetData || page === 0) {
        setCompanies(response.companies);
      } else {
        setCompanies(prev => [...prev, ...response.companies]);
      }

      setTotalCount(response.total_count);
      setHasMore(response.has_more);
    } catch (err) {
      console.error("Error loading companies:", err);
      setError("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [loading, companies, selectedCollectionId, pageSize]);

  // Load initial data when collection changes
  useEffect(() => {
    setCompanies([]);
    setSelectedRows([]);
    setCurrentPage(0);
    setIsSelectAllPages(false);
    setIsSelectCurrentPage(false);
    setAllCompanyIds([]);
    loadCompanies(0, true);
  }, [selectedCollectionId, pageSize]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const startIndex = newPage * pageSize;
    
    // If we don't have enough data, load more
    if (startIndex >= companies.length && hasMore) {
      loadCompanies(newPage);
    }
  };

  // Update selectedRows when page changes and we're in select-all-pages mode
  useEffect(() => {
    if (isSelectAllPages) {
      const currentPageData = getCurrentPageData();
      const currentPageIds = currentPageData.map(company => company.id);
      setSelectedRows(currentPageIds);
    }
  }, [currentPage, companies, isSelectAllPages]);

  // Get current page data
  const getCurrentPageData = () => {
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    return companies.slice(startIndex, endIndex);
  };

  // Handle select current page
  const handleSelectCurrentPage = (checked: boolean) => {
    setIsSelectCurrentPage(checked);
    if (checked) {
      const currentPageData = getCurrentPageData();
      const currentPageIds = currentPageData.map(company => company.id);
      setSelectedRows(currentPageIds);
      setIsSelectAllPages(false);
    } else {
      setSelectedRows([]);
    }
  };

  // Handle select all pages
  const handleSelectAllPages = async (checked: boolean) => {
    setIsSelectAllPages(checked);
    if (checked) {
      try {
        const response = await getAllCompanyIdsInCollection(selectedCollectionId);
        setAllCompanyIds(response.company_ids);
        setIsSelectCurrentPage(false);
        
        // Update selectedRows to include all visible companies so checkboxes appear selected
        const currentPageData = getCurrentPageData();
        const currentPageIds = currentPageData.map(company => company.id);
        setSelectedRows(currentPageIds);
      } catch (err) {
        console.error("Error fetching all company IDs:", err);
        setError("Failed to fetch all companies");
        setIsSelectAllPages(false);
      }
    } else {
      setSelectedRows([]);
      setAllCompanyIds([]);
    }
  };

  // Handle row selection change
  const handleRowSelectionChange = (newSelection: GridRowSelectionModel) => {
    // If we were in select-all-pages mode and user deselected some items,
    // we need to exit select-all-pages mode
    if (isSelectAllPages) {
      const currentPageData = getCurrentPageData();
      const currentPageIds = currentPageData.map(company => company.id);
      const deselectedIds = currentPageIds.filter(id => !newSelection.includes(id));
      
      if (deselectedIds.length > 0) {
        // User deselected some items, exit select-all-pages mode
        setIsSelectAllPages(false);
        setSelectedRows(newSelection);
        setAllCompanyIds([]);
      } else {
        // All visible items are still selected, just update the visual state
        setSelectedRows(newSelection);
      }
    } else {
      // Normal selection behavior
      setSelectedRows(newSelection);
    }
    
    // Check if current page selection matches and update current page checkbox
    const currentPageData = getCurrentPageData();
    const currentPageIds = currentPageData.map(company => company.id);
    const allCurrentPageSelected = currentPageIds.length > 0 && 
      currentPageIds.every(id => newSelection.includes(id));
    setIsSelectCurrentPage(allCurrentPageSelected);
  };

  // Get selected company IDs for batch operation
  const getSelectedCompanyIds = (): number[] => {
    if (isSelectAllPages) {
      return allCompanyIds;
    }
    return selectedRows.map(id => Number(id));
  };

  // Handle batch add operation
  const handleBatchAdd = async () => {
    const companyIds = getSelectedCompanyIds();
    if (companyIds.length === 0 || !targetCollectionId) return;

    try {
      setOperationType('ADD');
      const response = await createBatchAddJob({
        source_collection_id: selectedCollectionId,
        target_collection_id: targetCollectionId,
        company_ids: companyIds,
      });

      setBatchJobId(response.job_id);
      setShowBatchDialog(false);
      setShowProgressModal(true);
    } catch (err) {
      console.error("Error creating batch job:", err);
      setError("Failed to start batch operation");
    }
  };

  // Handle batch delete operation
  const handleBatchDelete = async () => {
    const companyIds = getSelectedCompanyIds();
    if (companyIds.length === 0) return;

    try {
      setOperationType('DELETE');
      const response = await createBatchDeleteJob({
        collection_id: selectedCollectionId,
        company_ids: companyIds,
      });

      setBatchJobId(response.job_id);
      setShowDeleteDialog(false);
      setShowProgressModal(true);
    } catch (err) {
      console.error("Error creating batch delete job:", err);
      setError("Failed to start delete operation");
    }
  };

  // Handle actions dropdown
  const handleAddToCollection = () => {
    setShowBatchDialog(true);
  };

  const handleDeleteFromCollection = () => {
    setShowDeleteDialog(true);
  };

  // Handle batch operation success
  const handleBatchSuccess = () => {
    setSelectedRows([]);
    setIsSelectAllPages(false);
    setIsSelectCurrentPage(false);
    setAllCompanyIds([]);
    setShowProgressModal(false);
    setBatchJobId(null);
    
    // Refresh the current collection data to show updated results
    loadCompanies(0, true);
  };

  const selectedCount = isSelectAllPages ? allCompanyIds.length : selectedRows.length;
  const targetCollection = collections.find(c => c.id === targetCollectionId);
  const currentCollection = collections.find(c => c.id === selectedCollectionId);
  
  // Determine if delete is allowed for current collection
  const canDeleteFromCollection = currentCollection && 
    currentCollection.collection_name !== "My List";
  
  // Get collection display name for progress modal
  const getCollectionNameForModal = () => {
    if (operationType === 'DELETE') {
      return currentCollection?.collection_name || 'this collection';
    }
    return targetCollection?.collection_name || 'target collection';
  };

  const columns: GridColDef[] = [
    { field: "liked", headerName: "Liked", width: 90, type: "boolean" },
    { field: "id", headerName: "ID", width: 90 },
    { field: "company_name", headerName: "Company Name", width: 300, flex: 1 },
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Selection and Batch Actions */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={
              <Checkbox
                checked={isSelectCurrentPage}
                onChange={(e) => handleSelectCurrentPage(e.target.checked)}
                disabled={loading}
              />
            }
            label="Select Current Page"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={isSelectAllPages}
                onChange={(e) => handleSelectAllPages(e.target.checked)}
                disabled={loading}
              />
            }
            label="Select All Pages"
          />

          {isSelectAllPages && (
            <Typography variant="body2" color="primary" sx={{ fontWeight: 'medium' }}>
              All pages selected, totally {totalCount.toLocaleString()} companies
            </Typography>
          )}

          {selectedCount > 0 && (
            <>
              {!isSelectAllPages && (
                <Typography variant="body2" color="text.secondary">
                  {selectedCount.toLocaleString()} companies selected
                </Typography>
              )}
              
              <ActionsDropdown
                selectedCount={selectedCount}
                currentCollectionName={currentCollection?.collection_name || ''}
                canDelete={!!canDeleteFromCollection}
                onAddToCollection={handleAddToCollection}
                onDeleteFromCollection={handleDeleteFromCollection}
                disabled={loading}
              />
            </>
          )}
        </Stack>
      </Box>

      {/* Data Grid */}
      <Box sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={getCurrentPageData()}
          columns={columns}
          rowHeight={30}
          loading={loading}
          checkboxSelection
          rowSelectionModel={selectedRows}
          onRowSelectionModelChange={handleRowSelectionChange}
          pagination
          paginationMode="server"
          rowCount={totalCount}
          paginationModel={{ page: currentPage, pageSize }}
          onPaginationModelChange={(model) => {
            setPageSize(model.pageSize);
            handlePageChange(model.page);
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Box>

      {/* Batch Add Confirmation Dialog */}
      <Dialog open={showBatchDialog} onClose={() => setShowBatchDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Companies to Collection</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Add {selectedCount.toLocaleString()} companies to:
          </Typography>
          
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Target Collection</InputLabel>
            <Select
              value={targetCollectionId}
              onChange={(e) => setTargetCollectionId(e.target.value)}
              label="Target Collection"
            >
              {collections
                .filter(c => c.id !== selectedCollectionId)
                .map(collection => (
                  <MenuItem key={collection.id} value={collection.id}>
                    {collection.collection_name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {selectedCount > 1000 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This operation will add {selectedCount.toLocaleString()} companies. 
              It may take a few minutes to complete.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBatchDialog(false)}>Cancel</Button>
          <Button
            onClick={handleBatchAdd}
            variant="contained"
            disabled={!targetCollectionId}
          >
            Start Adding
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Companies</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete {selectedCount.toLocaleString()} companies from "{currentCollection?.collection_name}"?
          </Typography>
          
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The companies will be removed from this collection.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleBatchDelete}
            variant="contained"
            color="error"
          >
            Delete Companies
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Progress Modal */}
      <BatchProgressModal
        open={showProgressModal}
        jobId={batchJobId}
        onClose={() => setShowProgressModal(false)}
        onSuccess={handleBatchSuccess}
        targetCollectionName={getCollectionNameForModal()}
      />
    </Box>
  );
}

export default CompanyTable;
