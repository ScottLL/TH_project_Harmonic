import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  KeyboardArrowDown as ArrowDownIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface ActionsDropdownProps {
  selectedCount: number;
  currentCollectionName: string;
  canDelete: boolean;
  onAddToCollection: () => void;
  onDeleteFromCollection: () => void;
  disabled?: boolean;
}

function ActionsDropdown({
  selectedCount,
  currentCollectionName,
  canDelete,
  onAddToCollection,
  onDeleteFromCollection,
  disabled = false,
}: ActionsDropdownProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAddToCollection = () => {
    handleClose();
    onAddToCollection();
  };

  const handleDeleteFromCollection = () => {
    handleClose();
    onDeleteFromCollection();
  };

  return (
    <>
      <Button
        variant="contained"
        onClick={handleClick}
        disabled={disabled || selectedCount === 0}
        endIcon={<ArrowDownIcon />}
        size="small"
      >
        Actions
      </Button>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleAddToCollection}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add to Collection</ListItemText>
        </MenuItem>
        
        {canDelete && (
          <>
            <Divider />
            <MenuItem onClick={handleDeleteFromCollection}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Delete from {currentCollectionName}
              </ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}

export default ActionsDropdown;