import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Portfolio from './components/Portfolio';
import AddAsset from './components/AddAsset';

const App = () => {
    return (
        <Router>
            <div>
                <nav>
                    <ul>
                        <li><a href="/">Portfolio</a></li>
                        <li><a href="/add-asset">Add Asset</a></li>
                    </ul>
                </nav>
                <Routes>
                    <Route path="/" element={<Portfolio />} />
                    <Route path="/add-asset" element={<AddAsset />} />
                </Routes>
            </div>
        </Router>
    );
};

export default App;

