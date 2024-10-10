import { Players, ReplicatedStorage, UserInputService } from "@rbxts/services";

const FOLDER_NAME: string = "SISIGNALS";
const LINK_NAME: string = "LINK";

export type KEYBINDS_REGISTRY = Map<Enum.KeyCode | Enum.UserInputType, string>;
export type RESPONSE_REGISTRY = Map<string, () => void>;

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
		Listen: () => {
			// User input
			const connection = UserInputService.InputBegan.Connect((input: InputObject, gameProcess: boolean) => {
				if (gameProcess) return;

				const key = this.Client.Keybinds.get(input.KeyCode) || this.Client.Keybinds.get(input.UserInputType);

				if (key) {
					this.Link.FireServer(key);
					const callback = this.Client.Responses.get(key.lower());
					if (callback) {
						callback();
					} else warn(`${key} callback was not found but is a registered bind.`);
				}
			});

			Players.PlayerRemoving.Connect(() => {
				connection.Disconnect();
			});
		},

		SetClientBinds: (Binds: KEYBINDS_REGISTRY) => {
			Binds.forEach((v, k) => {
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
						response();
					} else warn(`${key} callback was not found but is a registered bind.`);
				} else warn("server: key is not a string");
			});
		},

		SetDefaultBinds: (Binds: KEYBINDS_REGISTRY) => {
			this.DefaultBinds = Binds;
		},

		SetServerResponses: (sentReponses: RESPONSE_REGISTRY) => {
			sentReponses.forEach((v, k) => {
				this.Server.Responses.set(k.lower(), v);
			});
		},
	};
}

export default new SimpleInput();
