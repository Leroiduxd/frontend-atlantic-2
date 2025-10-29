import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface PositionDetail {
  id: number;
  state: number;
  asset_id: number;
  trader_addr: string;
  trader_addr_lc: string;
  long_side: boolean;
  lots: number;
  leverage_x: number;
  entry_x6: number;
  target_x6: number;
  sl_x6: number;
  tp_x6: number;
  liq_x6: number;
  close_reason: string | null;
  exec_x6: number | null;
  pnl_usd6: number | null;
  notional_usd6: number;
  margin_usd6: number;
  created_at: string;
  updated_at: string;
}

interface TraderData {
  trader: string;
  orders: number[];
  open: number[];
  cancelled: number[];
  closed: number[];
}

export const usePositions = () => {
  const { address } = useAccount();
  const [positions, setPositions] = useState<PositionDetail[]>([]);
  const [orders, setOrders] = useState<PositionDetail[]>([]);
  const [closedPositions, setClosedPositions] = useState<PositionDetail[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<PositionDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setOrders([]);
      setClosedPositions([]);
      setCancelledOrders([]);
      setLoading(false);
      return;
    }

    const fetchPositions = async () => {
      try {
        const traderResponse = await fetch(`https://api.brokex.trade/trader/${address}`);
        const traderData: TraderData = await traderResponse.json();

        const fetchPositionDetails = async (ids: number[]) => {
          const details = await Promise.all(
            ids.map(async (id) => {
              try {
                const response = await fetch(`https://api.brokex.trade/position/${id}`);
                return await response.json();
              } catch (error) {
                console.error(`Error fetching position ${id}:`, error);
                return null;
              }
            })
          );
          return details.filter(Boolean);
        };

        const [openPos, pendingOrd, closedPos, cancelledOrd] = await Promise.all([
          fetchPositionDetails(traderData.open),
          fetchPositionDetails(traderData.orders),
          fetchPositionDetails(traderData.closed),
          fetchPositionDetails(traderData.cancelled),
        ]);

        setPositions(openPos);
        setOrders(pendingOrd);
        setClosedPositions(closedPos);
        setCancelledOrders(cancelledOrd);
      } catch (error) {
        console.error('Error fetching positions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);

    return () => clearInterval(interval);
  }, [address]);

  return { positions, orders, closedPositions, cancelledOrders, loading };
};
