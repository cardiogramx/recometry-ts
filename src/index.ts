import { HubConnectionBuilder, HttpTransportType, HubConnectionState, HubConnection } from "@microsoft/signalr";

export type RecometryConfig = {
  apiKey: string,
  env: 'sandbox' | 'live',
  onError?(e: any): Promise<void>;
}

export type RecometryEvent = {
  id: string,
  type: 'click' | 'rating',
  data: Record<string, any>,
  productId: number, userId: string
}

export type RecommendationRequest = {
  modelId: string,
  userId: string,
  limit: number
}

export type Recommendation = {
  userId: string,
  productId: string,
  score: number,
}

export type PredictionRequest = {
  modelId: string,
  data: Record<string, any>,
  limit: number
}

export type Prediction = {
  predictedLabel: boolean,
  probability?: number,
  score: number,
}

export type TypedResponse<T> = {
  status: boolean,
  message: string,
  data: T
}

export class Recometry {
  private readonly configuration: RecometryConfig;
  private readonly baseUrl: string;
  private readonly websocket: HubConnection;
  /**
   * Creates a new Recometry instance and connects automatically.
   */
  constructor(config: RecometryConfig) {
    if (!config) {
      throw new Error("config is required");
    }
    
    this.configuration = config;
    this.baseUrl = config.env === 'live' ? 'https://api.recometry.com' : 'https://localhost:5001';

    // Build the SignalR connection
    this.websocket = new HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/metrics`, {
        accessTokenFactory: () => config.apiKey,
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.websocket.on("error", async (err) => {
      console.log("error", err);
      if (config.onError) await config.onError(err);
    });

    // Automatically connect on construction
    this.connect();
  }

  private async connect() {
    try {
      if (this.websocket.state === HubConnectionState.Connected) {
        return;
      }
      await this.websocket.start();
    } catch (err) {
      console.error("Connect failed:", err);
    }
  }

  private async disconnect () {
    try {
      
      if (this.websocket?.state !== HubConnectionState.Disconnected) {
        await this.websocket?.stop();
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  private async reconnect () {
    try {

      if (this.websocket?.state === HubConnectionState.Connected) {
        return;
      }

      await this.disconnect();
      await this.connect();

    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Sends event to the server for collection
   */
  async collect(event: RecometryEvent) {
    try {
      await this.reconnect(); //reconnects if disconnected
      await this.websocket.invoke("collect", event);
    } catch (err) {
      console.error("Collect failed:", err);
    }
  }

  /**
   * Sends a recommendation request
   */
  async recommend(payload: RecommendationRequest) {
    return await fetch(`${this.baseUrl}/api/v1/ml/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.configuration.apiKey}`
      },
      body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(response => <TypedResponse<Recommendation[]>>response);
  }

  /**
   * Sends a prediction request
   */
  async predict(payload: PredictionRequest) {
    return await fetch(`${this.baseUrl}/api/v1/ml/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.configuration.apiKey}`
      },
      body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(response => <TypedResponse<Prediction[]>>response);
  }
}