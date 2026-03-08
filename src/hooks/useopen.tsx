import { useState, useEffect, useRef } from "react";

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

type MarketKind = "crypto" | "forex" | "commodities" | "stocks" | "indices";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

const addMinutes = (d: Date, mins: number) => new Date(d.getTime() + mins * 60000);
const startOfUTCDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const getMarketKindFromId = (id: number): MarketKind | null => {
  if (id >= 0 && id < 1000) return "crypto";
  if (id >= 5000 && id < 5100) return "forex";
  if (id >= 5500 && id < 5600) return "commodities";
  if (id >= 6000 && id < 6100) return "stocks";
  if (id >= 6100 && id < 6200) return "indices";
  return null;
};

export interface MarketSchedule {
  kind: MarketKind;
  alwaysOpen?: boolean;
  dailyWindowsUTC?: { [day: number]: Array<[number, number]> }; // 0=Sun..6=Sat, minutes (ex: 1440 = minuit)
}

/** * Règles (UTC) - RÉÉCRITES POUR ÊTRE 100% PRÉCISES JOUR PAR JOUR
 */
export const getMarketScheduleUTC = (kind: MarketKind): MarketSchedule => {
  switch (kind) {
    case "crypto":
      return { kind, alwaysOpen: true };
      
    case "forex":
      // Forex : Sun 22:00 → Fri 21:00 UTC (Continu)
      return {
        kind,
        dailyWindowsUTC: {
          0: [[toMinutes("22:00"), 1440]], // Dimanche: 22h à Minuit (1440)
          1: [[0, 1440]], // Lundi: 24h/24
          2: [[0, 1440]], // Mardi: 24h/24
          3: [[0, 1440]], // Mercredi: 24h/24
          4: [[0, 1440]], // Jeudi: 24h/24
          5: [[0, toMinutes("21:00")]], // Vendredi: Minuit à 21h
          6: [], // Samedi: Fermé
        },
      };

    case "commodities":
    case "indices":
      // Sun 23:00 → Fri 22:00 UTC ; Avec pause tous les jours de 22:00 à 23:00
      return {
        kind,
        dailyWindowsUTC: {
          0: [[toMinutes("23:00"), 1440]], // Dimanche: 23h à Minuit
          1: [[0, toMinutes("22:00")], [toMinutes("23:00"), 1440]], // Lundi: 0h-22h et 23h-Minuit
          2: [[0, toMinutes("22:00")], [toMinutes("23:00"), 1440]], // Mardi: idem
          3: [[0, toMinutes("22:00")], [toMinutes("23:00"), 1440]], // Mercredi: idem
          4: [[0, toMinutes("22:00")], [toMinutes("23:00"), 1440]], // Jeudi: idem
          5: [[0, toMinutes("22:00")]], // Vendredi: 0h à 22h. (Pas de réouverture à 23h)
          6: [], // Samedi: Fermé
        },
      };

    case "stocks":
      // Actions : Mon–Fri 14:30–21:00 UTC
      return {
        kind,
        dailyWindowsUTC: {
          0: [], // Dimanche: Fermé
          1: [[toMinutes("14:30"), toMinutes("21:00")]],
          2: [[toMinutes("14:30"), toMinutes("21:00")]],
          3: [[toMinutes("14:30"), toMinutes("21:00")]],
          4: [[toMinutes("14:30"), toMinutes("21:00")]],
          5: [[toMinutes("14:30"), toMinutes("21:00")]],
          6: [], // Samedi: Fermé
        },
      };
  }
};

/** * CORRECTION CRITIQUE : Génère et FUSIONNE les intervalles d’ouverture pour les N prochains jours 
 */
const buildOpenIntervals = (kind: MarketKind, from: Date, daysAhead = 8): Array<[Date, Date]> => {
  const sched = getMarketScheduleUTC(kind);
  
  if (sched.alwaysOpen) {
    const start = startOfUTCDay(from);
    return [[start, addMinutes(start, daysAhead * 1440)]];
  }

  const rawIntervals: Array<[Date, Date]> = [];

  // 1. On génère tous les intervalles jour par jour
  for (let d = 0; d < daysAhead; d++) {
    const dayDate = addMinutes(startOfUTCDay(from), d * 1440); // Date absolue à minuit UTC
    const weekday = dayDate.getUTCDay(); // 0 = Dimanche, etc.
    
    // On récupère les minutes d'ouverture pour ce jour précis
    const dayRanges = sched.dailyWindowsUTC?.[weekday] || [];

    for (const [startMin, endMin] of dayRanges) {
        rawIntervals.push([
            new Date(dayDate.getTime() + startMin * 60000), // Heure d'ouverture absolue
            new Date(dayDate.getTime() + endMin * 60000)    // Heure de fermeture absolue
        ]);
    }
  }

  // 2. On s'assure qu'ils sont bien triés du plus ancien au plus récent
  rawIntervals.sort((a, b) => a[0].getTime() - b[0].getTime());

  // 3. LA MAGIE EST ICI : Fusion des intervalles adjacents
  // Évite que le marché "ferme" à 23h59:59 pour rouvrir à 00h00:00 (Cas du Forex)
  const mergedIntervals: Array<[Date, Date]> = [];
  
  for (const [start, end] of rawIntervals) {
    if (mergedIntervals.length === 0) {
        mergedIntervals.push([start, end]);
    } else {
        const lastMerged = mergedIntervals[mergedIntervals.length - 1];
        // Si cet intervalle commence exactement à la fin du précédent (ou avant), on les soude
        if (start.getTime() <= lastMerged[1].getTime()) {
            lastMerged[1] = new Date(Math.max(lastMerged[1].getTime(), end.getTime()));
        } else {
            mergedIntervals.push([start, end]);
        }
    }
  }

  return mergedIntervals;
};

export interface MarketStatus {
  isOpen: boolean;
  nextOpen: Date | null;
  timeUntilOpenMs?: number;
  timeUntilCloseMs?: number;
}

/** Renvoie statut + prochaine ouverture/fermeture (UTC) */
export const getMarketStatusUTC = (kind: MarketKind, at: Date = new Date()): MarketStatus => {
  const intervals = buildOpenIntervals(kind, at, 8);
  const now = at.getTime();

  for (const [start, end] of intervals) {
    const s = start.getTime();
    const e = end.getTime();
    
    // Si on est DANS l'intervalle
    if (now >= s && now < e) {
      return {
        isOpen: true,
        nextOpen: null,
        timeUntilCloseMs: e - now,
      };
    }
    // Si l'intervalle est dans le FUTUR (comme ils sont triés, c'est la prochaine ouverture)
    if (now < s) {
      return {
        isOpen: false,
        nextOpen: start,
        timeUntilOpenMs: s - now,
      };
    }
  }
  
  // Si rien trouvé (Sécurité, ne devrait jamais arriver avec une recherche sur 8 jours)
  return { isOpen: false, nextOpen: null };
};

/** Hook WS (Intact) */
export const useWebSocket = () => {
  const [data, setData] = useState<WebSocketMessage>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket("wss://backend.brokex.trade/ws/prices");
        ws.onopen = () => setConnected(true);
        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            setData(message);
          } catch (e) {
            console.error("WS parse error:", e);
          }
        };
        ws.onerror = (e) => console.error("WS error:", e);
        ws.onclose = () => {
          setConnected(false);
          reconnectRef.current = setTimeout(connect, 3000);
        };
        wsRef.current = ws;
      } catch (e) {
        console.error("WS create error:", e);
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { data, connected };
};

export const getAssetsByCategory = (data: WebSocketMessage) => {
  const assets = Object.entries(data)
    .filter(([, p]) => p?.instruments?.length > 0)
    .map(([pair, p]) => {
      const kind = getMarketKindFromId(p.id);
      const symbol = pair.toUpperCase().replace("_", "/");
      const price = p.instruments[0]?.currentPrice ?? "0";
      const chg = p.instruments[0]?.["24h_change"] ?? "0";
      const status = kind ? getMarketStatusUTC(kind) : { isOpen: false, nextOpen: null };

      return {
        id: p.id,
        name: p.name,
        symbol,
        pair,
        currentPrice: price,
        change24h: chg,
        kind,
        marketOpenUTC: status.isOpen,
        nextOpenUTC: status.nextOpen?.toISOString() ?? null,
        timeUntilOpenMs: status.timeUntilOpenMs ?? null,
        timeUntilCloseMs: status.timeUntilCloseMs ?? null,
      };
    });

  return {
    crypto: assets.filter((a) => a.id >= 0 && a.id < 1000),
    forex: assets.filter((a) => a.id >= 5000 && a.id < 5100),
    commodities: assets.filter((a) => a.id >= 5500 && a.id < 5600),
    stocks: assets.filter((a) => a.id >= 6000 && a.id < 6100),
    indices: assets.filter((a) => a.id >= 6100 && a.id < 6200),
  };
};

/** Label lisible mis à jour */
export const getReadableHoursUTC = (kind: MarketKind): string => {
  switch (kind) {
    case "crypto":
      return "24/7 (UTC)";
    case "forex":
      return "Sun 22:00 → Fri 21:00 UTC (continu)";
    case "commodities":
    case "indices":
      return "Sun 23:00 → Fri 22:00 UTC ; pause 22:00–23:00 chaque jour";
    case "stocks":
      return "Mon–Fri 14:30–21:00 UTC";
  }
};