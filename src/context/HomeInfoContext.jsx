import { createContext, useContext, useState, useEffect } from 'react';
import getHomeInfo from '../utils/getHomeInfo.utils.js';

const HomeInfoContext = createContext();

export const HomeInfoProvider = ({ children }) => {
    const [homeInfo, setHomeInfo] = useState(() => {
    const cached = localStorage.getItem("homeInfo");
    return cached ? JSON.parse(cached) : null;
    });
    const [homeInfoLoading, setHomeInfoLoading] = useState(!homeInfo);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchHomeInfo = async () => {
            try {
                const data = await getHomeInfo();
                setHomeInfo(data);
            } catch (err) {
                console.error("Error fetching home info:", err);
                setError(err);
            } finally {
                setHomeInfoLoading(false);
            }
        };
        fetchHomeInfo();
    }, []);
    return (
        <HomeInfoContext.Provider value={{ homeInfo, homeInfoLoading, error }}>
            {children}
        </HomeInfoContext.Provider>
    );
};

export const useHomeInfo = () => useContext(HomeInfoContext);
