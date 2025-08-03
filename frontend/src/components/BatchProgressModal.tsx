import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { getBatchJobStatus, cancelBatchJob, IBatchJobResponse } from '../utils/jam-api';

interface BatchProgressModalProps {
  open: boolean;
  jobId: string | null;
  onClose: () => void;
  onSuccess?: (jobId: string) => void;
  targetCollectionName?: string;
}

function BatchProgressModal({
  open,
  jobId,
  onClose,
  onSuccess,
  targetCollectionName = 'target collection'
}: BatchProgressModalProps) {
  const [jobStatus, setJobStatus] = useState<IBatchJobResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Poll for job status updates
  useEffect(() => {
    if (!open || !jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await getBatchJobStatus(jobId);
        setJobStatus(status);
        
        // Stop polling if job is completed, failed, or cancelled
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.status)) {
          clearInterval(pollInterval);
          if (status.status === 'COMPLETED' && onSuccess) {
            onSuccess(jobId);
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
        setError('Failed to fetch job status');
      }
    }, 300); // Poll every 300ms for smoother progress updates

    // Initial fetch
    if (jobId) {
      setLoading(true);
      getBatchJobStatus(jobId)
        .then(setJobStatus)
        .catch((err) => {
          console.error('Error fetching initial job status:', err);
          setError('Failed to fetch job status');
        })
        .finally(() => setLoading(false));
    }

    return () => clearInterval(pollInterval);
  }, [open, jobId, onSuccess]);

  const handleCancel = async () => {
    if (!jobId) return;
    
    setIsCancelling(true);
    try {
      await cancelBatchJob(jobId);
      // Status will be updated by the next poll
    } catch (err) {
      console.error('Error cancelling job:', err);
      setError('Failed to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  const getProgressPercentage = () => {
    if (!jobStatus || jobStatus.total_count === 0) return 0;
    return Math.round((jobStatus.processed_count / jobStatus.total_count) * 100);
  };

  const getStatusColor = () => {
    if (!jobStatus) return 'primary';
    switch (jobStatus.status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'CANCELLED':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const getStatusMessage = () => {
    if (!jobStatus) return 'Initializing...';
    
    const isDeleteOperation = jobStatus.job_type === 'DELETE';
    const actionWord = isDeleteOperation ? 'Deleting' : 'Adding';
    const preposition = isDeleteOperation ? 'from' : 'to';
    const completedActionWord = isDeleteOperation ? 'deleted' : 'added';
    const completedPreposition = isDeleteOperation ? 'from' : 'to';
    
    switch (jobStatus.status) {
      case 'PENDING':
        return 'Job is queued and waiting to start...';
      case 'IN_PROGRESS':
        return `${actionWord} companies ${preposition} ${targetCollectionName}...`;
      case 'COMPLETED':
        return `Successfully ${completedActionWord} ${jobStatus.processed_count} companies ${completedPreposition} ${targetCollectionName}!`;
      case 'FAILED':
        return `Job failed: ${jobStatus.error_message || 'Unknown error'}`;
      case 'CANCELLED':
        return 'Job was cancelled';
      default:
        return 'Unknown status';
    }
  };

  const canCancel = jobStatus && ['PENDING', 'IN_PROGRESS'].includes(jobStatus.status);
  const isCompleted = jobStatus && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(jobStatus.status);

  return (
    <Dialog open={open} onClose={isCompleted ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isCompleted 
          ? 'Batch Operation Complete' 
          : jobStatus?.job_type === 'DELETE' 
            ? 'Deleting Companies...' 
            : 'Adding Companies...'
        }
      </DialogTitle>
      
      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {jobStatus && !loading && (
          <Box>
            <Typography variant="body1" gutterBottom>
              {getStatusMessage()}
            </Typography>
            
            {jobStatus.status === 'IN_PROGRESS' && (
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {jobStatus.processed_count} / {jobStatus.total_count} ({getProgressPercentage()}%)
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={getProgressPercentage()} 
                  color={getStatusColor() as any}
                />
              </Box>
            )}
            
            {jobStatus.status === 'COMPLETED' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {jobStatus.job_type === 'DELETE' 
                  ? `All companies have been successfully deleted from ${targetCollectionName}!`
                  : `All companies have been successfully added to ${targetCollectionName}!`
                }
              </Alert>
            )}
            
            {jobStatus.status === 'FAILED' && (
              <Alert severity="error" sx={{ mt: 2 }}>
                The batch operation failed. Please try again.
              </Alert>
            )}
            
            {jobStatus.status === 'CANCELLED' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                The batch operation was cancelled.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {canCancel && (
          <Button 
            onClick={handleCancel}
            disabled={isCancelling}
            color="warning"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </Button>
        )}
        
        {isCompleted && (
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default BatchProgressModal;