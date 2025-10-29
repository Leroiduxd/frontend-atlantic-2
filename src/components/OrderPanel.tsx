import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault";
import { useTrading } from "@/hooks/useTrading";
import { useToast } from "@/hooks/use-toast";
import { DepositDialog } from "./DepositDialog";
import { Asset } from "./ChartControls";

type OrderType = "limit" | "market";

interface OrderPanelProps {
  selectedAsset: Asset;
  currentPrice: number;
}

const OrderPanel = ({ selectedAsset, currentPrice }: OrderPanelProps) => {
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [leverage, setLeverage] = useState(10);
  const [lots, setLots] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const { balance, available, locked, refetchAll } = useVault();
  const { openPosition } = useTrading();
  const { toast } = useToast();

  // Update limit price when current price changes or asset changes
  useEffect(() => {
    if (currentPrice > 0 && !limitPrice) {
      setLimitPrice(currentPrice.toString());
    }
  }, [currentPrice, selectedAsset.id]);

  // Calculate trade values
  const calculations = useMemo(() => {
    const price = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;
    const notional = (lots * 0.01) * price; // lots * BTC per lot * price
    const margin = notional / leverage;
    
    // Liquidation price calculation
    // For long: liqPrice = entryPrice * (1 - 1/leverage)
    // For short: liqPrice = entryPrice * (1 + 1/leverage)
    const liqPriceLong = price * (1 - 0.99 / leverage);
    const liqPriceShort = price * (1 + 0.99 / leverage);

    return {
      value: notional,
      cost: margin,
      liqPriceLong,
      liqPriceShort,
    };
  }, [lots, leverage, limitPrice, currentPrice, orderType]);

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  const handleTrade = async (longSide: boolean) => {
    setLoading(true);
    try {
      const isLimit = orderType === 'limit';
      const priceX6 = isLimit && limitPrice ? Math.round(Number(limitPrice) * 1000000) : 0;
      const slX6 = slEnabled && slPrice ? Math.round(Number(slPrice) * 1000000) : 0;
      const tpX6 = tpEnabled && tpPrice ? Math.round(Number(tpPrice) * 1000000) : 0;

      await openPosition({
        longSide,
        leverageX: leverage,
        lots,
        isLimit,
        priceX6,
        slX6,
        tpX6,
      });

      toast({
        title: 'Order placed',
        description: `${longSide ? 'Buy' : 'Sell'} order placed successfully`,
      });

      // Reset form
      setLimitPrice('');
      setTpPrice('');
      setSlPrice('');
      setTpEnabled(false);
      setSlEnabled(false);

      setTimeout(() => refetchAll(), 2000);
    } catch (error: any) {
      toast({
        title: 'Order failed',
        description: error?.message || 'Transaction failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[320px] h-full flex flex-col border-l border-border shadow-md bg-card">
      {/* Order Panel Content (Scrollable) */}
      <div className="flex-grow p-4 space-y-5 overflow-y-auto custom-scrollbar">
        {/* 1. Tabs (Limit, Market) and Leverage */}
        <div className="flex justify-between items-center border-b border-border text-muted-foreground font-medium text-sm pt-1 pb-2">
          <div className="flex">
            <div
              className={`py-1 mr-4 cursor-pointer transition duration-150 ${
                orderType === "limit"
                  ? "text-foreground border-b-2 border-foreground"
                  : "hover:text-foreground"
              }`}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </div>
            <div
              className={`py-1 mr-4 cursor-pointer transition duration-150 ${
                orderType === "market"
                  ? "text-foreground border-b-2 border-foreground"
                  : "hover:text-foreground"
              }`}
              onClick={() => setOrderType("market")}
            >
              Market
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="w-16 h-6 text-xs p-1 text-center"
              min="1"
              max="100"
            />
            <span className="text-xs font-semibold text-foreground">x</span>
          </div>
        </div>

        {/* 2. Limit Price Input */}
        {orderType === "limit" && (
          <div>
            <span className="text-light-text text-xs block mb-1">Limit Price (USD)</span>
            <Input
              type="number"
              placeholder="0.00"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full text-lg font-medium"
              step="0.01"
            />
          </div>
        )}

        {/* 3. Amount Input (Lots) */}
        <div>
          <span className="text-light-text text-xs block mb-1">Lots (1 lot = 0.01 BTC)</span>
          <Input
            type="number"
            value={lots}
            onChange={(e) => setLots(Math.max(1, Number(e.target.value)))}
            className="w-full text-lg font-medium"
            min="1"
            step="1"
          />
        </div>

        {/* 4. Percentage Buttons */}
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {["10%", "25%", "50%", "75%", "100%"].map((percentage) => (
            <Button
              key={percentage}
              variant="secondary"
              size="sm"
              className="text-xs py-1.5"
            >
              {percentage}
            </Button>
          ))}
        </div>

        {/* 5. Take Profit / Stop Loss */}
        <div className="space-y-3">
          {/* Take Profit Toggle */}
          <div>
            <label className="flex items-center text-foreground cursor-pointer mb-2">
              <Checkbox
                checked={tpEnabled}
                onCheckedChange={(checked) => setTpEnabled(checked as boolean)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Take Profit</span>
            </label>
            {tpEnabled && (
              <div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                  className="w-full text-sm font-medium"
                  step="0.01"
                />
              </div>
            )}
          </div>

          {/* Stop Loss Toggle */}
          <div>
            <label className="flex items-center text-foreground cursor-pointer mb-2">
              <Checkbox
                checked={slEnabled}
                onCheckedChange={(checked) => setSlEnabled(checked as boolean)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Stop Loss</span>
            </label>
            {slEnabled && (
              <div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                  className="w-full text-sm font-medium"
                  step="0.01"
                />
              </div>
            )}
          </div>
        </div>

        {/* 6. Buy / Sell Buttons */}
        <div className="flex space-x-3 pt-2 pb-3">
          <Button
            onClick={() => handleTrade(true)}
            disabled={loading}
            className="flex-1 bg-trading-blue hover:bg-trading-blue/90 text-white font-bold shadow-md"
          >
            {loading ? 'Processing...' : 'Buy'}
          </Button>
          <Button
            onClick={() => handleTrade(false)}
            disabled={loading}
            className="flex-1 bg-trading-red hover:bg-trading-red/90 text-white font-bold shadow-md"
          >
            {loading ? 'Processing...' : 'Sell'}
          </Button>
        </div>

        {/* 7. Account Details (First Block) */}
        <div className="text-sm space-y-1.5 pt-3 border-t border-border">
          <div className="flex justify-between text-light-text">
            <span>Value</span>
            <span className="text-foreground">${formatPrice(calculations.value)}</span>
          </div>
          <div className="flex justify-between text-light-text">
            <span>Cost (Margin)</span>
            <span className="text-foreground">${formatPrice(calculations.cost)}</span>
          </div>
          <div className="flex justify-between text-light-text">
            <span>Est. Liq. Price (Long/Short)</span>
            <span className="text-foreground text-xs">
              ${formatPrice(calculations.liqPriceLong)} / ${formatPrice(calculations.liqPriceShort)}
            </span>
          </div>
        </div>

        {/* 8. Trading Account Balance */}
        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">Trading Account</span>
            <span className="text-sm font-bold text-primary">${balance}</span>
          </div>
          <DepositDialog />
        </div>

        {/* 9. Account Details (Second Block) */}
        <div className="text-sm space-y-1.5 pt-2">
          <div className="flex justify-between text-light-text">
            <span>Balance (Total)</span>
            <span className="text-foreground">${balance}</span>
          </div>
          <div className="flex justify-between text-light-text">
            <span>Available Balance</span>
            <span className="text-foreground">${available}</span>
          </div>
          <div className="flex justify-between text-light-text">
            <span>Locked (Margin)</span>
            <span className="text-foreground">${locked}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPanel;
