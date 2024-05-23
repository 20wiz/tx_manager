import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

const Chart = () => {
    const [chartData, setChartData] = useState({
        labels: [],
        datasets: []
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/data');
                const data = response.data;

                if (data && data.length > 0) {
                    const labels = data.map((_, index) => `Data ${index + 1}`);
                    const userTokenSumUSD = data.map(item => item.userTokenSumUSD);
                    const pendingRewardUSD = data.map(item => item.pendingRewardUSD);
                    const poolUserAssetUSD = data.map(item => item.poolUserAssetUSD);

                    setChartData({
                        labels,
                        datasets: [
                            {
                                label: 'User Token Sum USD',
                                data: userTokenSumUSD,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            },
                            {
                                label: 'Pending Reward USD',
                                data: pendingRewardUSD,
                                borderColor: 'rgba(153, 102, 255, 1)',
                                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                            },
                            {
                                label: 'Total User Asset Value',
                                data: poolUserAssetUSD,
                                borderColor: 'rgba(255, 159, 64, 1)',
                                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            },
                        ],
                    });
                } else {
                    console.error('No data available');
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    return (
        <div>
            <h2>Asset Data Chart</h2>
            <Line data={chartData} />
        </div>
    );
};

export default Chart;

