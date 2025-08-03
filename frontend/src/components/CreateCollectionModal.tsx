import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
} from '@mui/material';
import { createCollection } from '../utils/jam-api';

interface CreateCollectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newCollection: { id: string; collection_name: string }) => void;
}

function CreateCollectionModal({ open, onClose, onSuccess }: CreateCollectionModalProps) {
  const [collectionName, setCollectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setCollectionName('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collectionName.trim()) {
      setError('Collection name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await createCollection({
        collection_name: collectionName.trim(),
      });

      onSuccess({
        id: response.id,
        collection_name: response.collection_name,
      });

      handleClose();
    } catch (err: any) {
      console.error('Error creating collection:', err);
      
      if (err.response?.status === 400) {
        setError('Collection name already exists');
      } else {
        setError('Failed to create collection. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Collection</DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Collection Name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              disabled={loading}
              placeholder="Enter collection name..."
              variant="outlined"
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !collectionName.trim()}
          >
            {loading ? 'Creating...' : 'Create Collection'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default CreateCollectionModal;