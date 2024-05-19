import React, { useState } from 'react';
import axios from 'axios';

const AddAsset = () => {
    const [type, setType] = useState('');
    const [value, setValue] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const newAsset = {
            type,
            totalUserAssetValueUsd: parseFloat(value),
            timestamp: new Date().toISOString()
        };

        axios.post('/api/assets', newAsset)
            .then(response => {
                console.log('Asset added:', response.data);
                // Optionally, refresh the portfolio or clear the form
            })
            .catch(error => {
                console.error('Error adding asset:', error);
            });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Add New Asset</h2>
            <div>
                <label>Type:</label>
                <input type="text" value={type} onChange={(e) => setType(e.target.value)} required />
            </div>
            <div>
                <label>Value (USD):</label>
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <button type="submit">Add Asset</button>
        </form>
    );
};

export default AddAsset;

