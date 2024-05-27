import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import 'chartjs-adapter-moment';

const Chart = () => {
    const [chartData, setChartData] = useState({
        labels: [],
        datasets: []
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/data');
                const rawData = response.data;

                // Group data by poolName
                const dataByPool = rawData.reduce((acc, item) => {
                    const poolName = item.poolName;
                    if (!acc[poolName]) {
                        acc[poolName] = [];
                    }
                    acc[poolName].push(item);
                    return acc;
                }, {});

                // Prepare datasets and labels
                const datasets = [];
                const labels = rawData.map(item => {
                    const date = new Date(item.timestamp);
                    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
                }).filter((value, index, self) => self.indexOf(value) === index); // Remove duplicate labels

                Object.keys(dataByPool).forEach(poolName => {
                    const data = dataByPool[poolName];
                    datasets.push({
                        label: poolName,
                        data: labels.map(label => {
                            const item = data.find(d => {
                                const date = new Date(d.timestamp);
                                const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
                                return formattedDate === label;
                            });
                            return item ? item.poolUserAssetUSD : null;
                        }),
                        fill: false,
                        borderColor: getRandomColor(), // Implement getRandomColor function to assign colors
                    });
                });

                setChartData({
                    labels,
                    datasets
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    // Function to generate random colors for the datasets
    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    const options= {
        scales: {
          x: {
            type: 'time',
            time: {
              parser: 'yyyy-MM-dd HH:mm', // Adjust based on your date format
              tooltipFormat: 'yyyy-MM-dd HH:mm',
              unit: 'minute'
            },
            title: {
              display: true,
              text: 'Date and Time'
            }
          }
        }
      }

    return (
        <div>
            <h2>Pool Asset Data Chart</h2>
            <Line data={chartData} options={options} />
        </div>
    );
};

export default Chart;