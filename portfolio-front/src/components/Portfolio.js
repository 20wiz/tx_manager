import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Portfolio = () => {
    const [assets, setAssets] = useState([]);

    useEffect(() => {
        // Fetch assets from the backend
        axios.get('/api/assets')
            .then(response => {
                setAssets(response.data);
            })
            .catch(error => {
                console.error('Error fetching assets:', error);
            });
    }, []);

    return (
        <div>
            <h1>Portfolio</h1>
            <table>
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Value (USD)</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    {assets.map(asset => (
                        <tr key={asset._id}>
                            <td>{asset.type}</td>
                            <td>{asset.totalUserAssetValueUsd}</td>
                            <td>{new Date(asset.timestamp).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Portfolio;

