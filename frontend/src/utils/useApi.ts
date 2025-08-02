import { useEffect, useState } from 'react';



const useApi = <T>(apiFunction: () => Promise<T>) => {
    const [data, setData] = useState<T>();
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        apiFunction().then((response) => {
            setData(response);
        }).catch((error) => {
            setError(error.message);
        }).finally(() => {
            setLoading(false);
        });
    }, []);

    return { data, loading, error };
};

export default useApi;