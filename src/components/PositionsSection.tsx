import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePositions } from "@/hooks/usePositions";
import { format } from "date-fns";

type TabType = "openPositions" | "pendingOrders" | "closedPositions" | "cancelledOrders";

const PositionsSection = () => {
  const [activeTab, setActiveTab] = useState<TabType>("openPositions");
  const { positions, orders, closedPositions, cancelledOrders } = usePositions();

  const formatPrice = (value: number) => {
    return (value / 1000000).toFixed(2);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy-MM-dd HH:mm");
    } catch {
      return dateStr;
    }
  };

  const tabConfig = [
    { id: "openPositions" as const, label: `Open Positions (${positions.length})` },
    { id: "pendingOrders" as const, label: `Pending Orders (${orders.length})` },
    { id: "closedPositions" as const, label: `Closed Positions (${closedPositions.length})` },
    { id: "cancelledOrders" as const, label: `Cancelled Orders (${cancelledOrders.length})` },
  ];

  return (
    <section id="positions" className="snap-section flex flex-col justify-start p-0 h-screen w-full">
      {/* Tabs Navigation */}
      <div className="flex justify-start space-x-0 border-b border-border flex-shrink-0 bg-background">
        <div className="flex space-x-2 pl-0 pb-0 bg-transparent">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 rounded-none text-sm font-semibold transition duration-200 border-b-2 ${
                activeTab === tab.id
                  ? "bg-active-tab text-foreground border-foreground"
                  : "text-muted-foreground hover:bg-hover-bg border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-grow p-0 overflow-hidden bg-background">

        {/* Open Positions */}
        {activeTab === "openPositions" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Open Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Side / Lev.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Margin
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Current Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    P&L (ROE)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    TP/SL
                  </th>
                  <th className="pr-4 pl-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-light-text">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {positions.map((position) => (
                  <tr key={position.id} className="hover:bg-hover-bg transition duration-100">
                    <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                      BTC/USD
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(position.created_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      <span className={position.long_side ? "text-trading-blue font-bold" : "text-trading-red font-bold"}>
                        {position.long_side ? "LONG" : "SHORT"}
                      </span> / {position.leverage_x}x
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(position.margin_usd6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {formatPrice(position.entry_x6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-trading-blue">
                      {position.pnl_usd6 ? `$${formatPrice(position.pnl_usd6)}` : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      TP: {position.tp_x6 ? formatPrice(position.tp_x6) : 'N/A'}
                      <br />
                      SL: {position.sl_x6 ? formatPrice(position.sl_x6) : 'N/A'}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button className="text-trading-blue hover:text-trading-blue/80 text-xs">
                        Edit TP/SL
                      </button>
                      <Button
                        size="sm"
                        className="bg-trading-red/10 text-trading-red hover:bg-trading-red/20 text-xs font-semibold"
                      >
                        Close
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending Orders */}
        {activeTab === "pendingOrders" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Type / Side
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Limit Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    TP/SL
                  </th>
                  <th className="pr-4 pl-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-light-text">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-hover-bg transition duration-100">
                    <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                      BTC/USD
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      Limit / <span className={order.long_side ? "text-trading-blue font-bold" : "text-trading-red font-bold"}>
                        {order.long_side ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {formatPrice(order.target_x6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(order.margin_usd6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      TP: {order.tp_x6 ? formatPrice(order.tp_x6) : 'N/A'}
                      <br />
                      SL: {order.sl_x6 ? formatPrice(order.sl_x6) : 'N/A'}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs font-semibold"
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Closed Positions */}
        {activeTab === "closedPositions" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Open Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Close Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Side / Lev.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    P&L Net
                  </th>
                  <th className="pr-4 pl-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closedPositions.map((position) => (
                  <tr key={position.id} className="hover:bg-hover-bg transition duration-100">
                    <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                      BTC/USD
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(position.created_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(position.updated_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {position.long_side ? "Long" : "Short"} / {position.leverage_x}x
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold ${position.pnl_usd6 && position.pnl_usd6 > 0 ? 'text-trading-blue' : 'text-trading-red'}`}>
                      {position.pnl_usd6 ? `$${formatPrice(position.pnl_usd6)}` : '-'}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(position.margin_usd6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cancelled Orders */}
        {activeTab === "cancelledOrders" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Cancelled
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Type / Side
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Price
                  </th>
                  <th className="pr-4 pl-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cancelledOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-hover-bg transition duration-100">
                    <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                      BTC/USD
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(order.updated_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      Limit / <span className={order.long_side ? "text-trading-blue font-bold" : "text-trading-red font-bold"}>
                        {order.long_side ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {formatPrice(order.target_x6)}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(order.margin_usd6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default PositionsSection;
