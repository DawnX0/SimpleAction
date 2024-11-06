import { ContextActionService, ReplicatedStorage, RunService } from "@rbxts/services";

export type ActionType = {
	Name: string;
	Gesture: Enum.KeyCode | Enum.UserInputType;
	ClientOnStart: (player: Player) => void;
	ClientOnEnd?: (player: Player) => void;
	ServerOnStart: (player: Player) => void;
	ServerOnEnd?: (player: Player) => void;
	TouchButton?: boolean;
};

const ACTION_FOLDER_NAME = "Actions";
const LINK_NAME = "ActionLink";

class SimpleAction {
	private actions: Map<string, ActionType> = new Map();
	private link: RemoteEvent | undefined;

	constructor() {
		this.loadInputs();
	}

	private loadInputs() {
		const actionFolder = ReplicatedStorage.FindFirstChild(ACTION_FOLDER_NAME, true);
		if (!actionFolder) {
			error(`No folder named "${ACTION_FOLDER_NAME}" found in replicated storage.`);
		}

		this.link =
			(ReplicatedStorage.FindFirstChild(LINK_NAME) as RemoteEvent) ??
			(RunService.IsServer()
				? (() => {
						const newRemoteEvent = new Instance("RemoteEvent");
						newRemoteEvent.Name = LINK_NAME;
						newRemoteEvent.Parent = ReplicatedStorage;
						return newRemoteEvent;
					})()
				: undefined);

		for (const child of actionFolder.GetDescendants()) {
			if (child.IsA("ModuleScript")) {
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				const action = require(child) as ActionType;

				this.createAction(action);
			}
		}
	}

	createAction(actionData: ActionType) {
		if (this.actions.has(actionData.Name.lower())) {
			error(`Skill with name "${actionData.Name}" already exists.`);
		}
		this.actions.set(actionData.Name.lower(), actionData);
	}

	StartClient(player: Player) {
		if (!RunService.IsClient()) error("Must be called from the client!");
		const link = this.link;
		if (!link) error("No link event found.");

		this.actions.forEach((action) => {
			const { Name, Gesture, ClientOnStart, ClientOnEnd, TouchButton } = action;

			const ClientWrap = (actionName: string, state: Enum.UserInputState, inputObject: InputObject) => {
				if (state === Enum.UserInputState.Begin) {
					ClientOnStart(player);
					link.FireServer(actionName, false);
				} else if (state === Enum.UserInputState.End && ClientOnEnd) {
					ClientOnEnd(player);
					link.FireServer(actionName, true);
				}
			};

			ContextActionService.BindAction(Name, ClientWrap, TouchButton || false, Gesture);
		});
	}

	StartServer() {
		if (!RunService.IsServer()) error("Must be called from the server!");
		const link = this.link;
		if (!link) error("No link event found.");
		this.actions.forEach((action) => {
			const { Name, ServerOnStart, ServerOnEnd } = action;

			link.OnServerEvent.Connect((player, action, ended) => {
				if (typeIs(action, "string") && typeIs(ended, "boolean")) {
					if (Name.lower() === Name.lower()) {
						if (!ended) {
							ServerOnStart(player);
						} else if (ended && ServerOnEnd) {
							ServerOnEnd(player);
						}
					}
				} else warn(`error occured`);
			});
		});
	}
}

const simpleAction = new SimpleAction();
export default simpleAction;
