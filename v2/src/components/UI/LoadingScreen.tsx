import React from 'react';

export const LoadingScreen: React.FC = () => {
    return (
        <div id="loading-screen" className="overlay active" style={{ zIndex: 100 }}>
            <h2>Loading Assets...</h2>
        </div>
    );
};
