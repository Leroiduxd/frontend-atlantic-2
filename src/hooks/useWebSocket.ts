import { useState, useEffect, useRef } from 'react';

export interface InstrumentData {
  time: string;
  timestamp: string;
  currentPrice: string;
  "24h_high": string;
  "24h_low": string;
  "24h_change": string;
  tradingPair: string;
}

export interface PairData {
  id: number;
  name: string;
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  instruments: InstrumentData[];
}

export interface WebSocketMessage {
  [pair: string]: PairData;
}

export const useWebSocket = () => {
  const [data, setData] = useState<WebSocketMessage>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket('wss://wss.brokex.trade:8443');
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            setData(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnected(false);
          
          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        // Retry connection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { data, connected };
};

export const getAssetsByCategory = (data: WebSocketMessage) => {
  const assets = Object.entries(data)
    .filter(([_, pairData]) => pairData.instruments && pairData.instruments.length > 0)
    .map(([pair, pairData]) => ({
      id: pairData.id,
      name: pairData.name,
      symbol: pair.toUpperCase().replace('_', '/'),
      pair: pair,
      currentPrice: pairData.instruments[0]?.currentPrice || '0',
      change24h: pairData.instruments[0]?.["24h_change"] || '0',
    }));

  return {
    crypto: assets.filter(a => a.id >= 0 && a.id < 1000),
    forex: assets.filter(a => a.id >= 5000 && a.id < 5100),
    commodities: assets.filter(a => a.id >= 5500 && a.id < 5600),
    stocks: assets.filter(a => a.id >= 6000 && a.id < 6100),
    indices: assets.filter(a => a.id >= 6100),
  };
};
