import { Players, ReplicatedStorage, UserInputService } from "@rbxts/services";

const FOLDER_NAME: string = "SIMPLESIGNALS";
const LINK_NAME: string = "INPUT";

export type KEYBINDS_REGISTRY = Map<Enum.KeyCode | Enum.UserInputType, string>;
export type RESPONSE_REGISTRY = Map<string, (player: Player) => void>;

class SimpleInput {
	Signals = ReplicatedStorage.FindFirstChild(FOLDER_NAME) || new Instance("Folder", ReplicatedStorage);
	Link = (this.Signals.FindFirstChild(LINK_NAME) as RemoteEvent) || new Instance("RemoteEvent", this.Signals);
	DefaultBinds = new Map() as KEYBINDS_REGISTRY;
	constructor() {
		this.Signals.Name = FOLDER_NAME;
		this.Link.Name = LINK_NAME;
	}

	Client = {
		Keybinds: this.DefaultBinds || (new Map() as KEYBINDS_REGISTRY),
		Responses: new Map() as RESPONSE_REGISTRY,
		Listen: (player: Player) => {
			// User input
			const connection = UserInputService.InputBegan.Connect((input: InputObject, gameProcess: boolean) => {
				if (gameProcess) return;

				const key = this.Client.Keybinds.get(input.KeyCode) || this.Client.Keybinds.get(input.UserInputType);

				if (key) {
					this.Link.FireServer(key);
					const callback = this.Client.Responses.get(key.lower());
					if (callback) {
						callback(player);
					} else warn(`${key} callback was not found but is a registered bind.`);
				}
			});

			Players.PlayerRemoving.Connect(() => {
				connection.Disconnect();
			});
		},

		SetClientBinds: (sentBinds: KEYBINDS_REGISTRY) => {
			sentBinds.forEach((v, k) => {
				this.Client.Keybinds.set(k, v.lower());
			});
		},

		SetClientResponse: (sentReponses: RESPONSE_REGISTRY) => {
			sentReponses.forEach((v, k) => {
				this.Client.Responses.set(k.lower(), v);
			});
		},
	};

	Server = {
		Responses: new Map() as RESPONSE_REGISTRY,
		Listen: () => {
			this.Link.OnServerEvent.Connect((player: Player, key: string | unknown) => {
				if (typeIs(key, "string")) {
					const response = this.Server.Responses.get(key.lower());
					if (response) {
						response(player);
					} else warn(`${key} callback was not found but is a registered bind.`);
				} else warn("server: key is not a string");
			});
		},

		SetDefaultBinds: (sentBinds: Map<Enum.KeyCode | Enum.UserInputType, string>) => {
			sentBinds.forEach((v, k) => {
				this.Client.Keybinds.set(k, v.lower());
			});
		},

		SetServerResponses: (sentReponses: Map<string, (player: Player) => void>) => {
			sentReponses.forEach((v, k) => {
				this.Server.Responses.set(k.lower(), v);
			});
		},
	};
}

export default new SimpleInput();
