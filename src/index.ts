import { ContextActionService, ReplicatedStorage, RunService, UserInputService, UserService } from "@rbxts/services";

export type ActionType = {
	Name: string;
	InputMethod: "ContextAction" | "UserInput";
	Gesture: Enum.KeyCode | Enum.UserInputType;
	ClientOnStart: (player: Player) => void;
	ClientOnEnd?: (player: Player) => void;
	ServerOnStart: (player: Player) => void;
	ServerOnEnd?: (player: Player) => void;
	TouchButton?: boolean;
	AdditonalArguments?: { [key: string]: AttributeValue };
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

	checkRestrictions(model: Model, actionRestrictions: string[]): boolean {
		for (const restriction of actionRestrictions) {
			if (model.GetAttribute(restriction.lower())) {
				return true;
			}
		}
		return false;
	}

	StartClient(player: Player) {
		if (!RunService.IsClient()) error("Must be called from the client!");
		const link = this.link;
		if (!link) error("No link event found.");

		this.actions.forEach((action) => {
			const { Name, InputMethod, Gesture, ClientOnStart, ClientOnEnd, TouchButton } = action;

			if (InputMethod === "ContextAction") {
				// Handle ContextAction input
				const ClientWrap = (actionName: string, state: Enum.UserInputState, inputObject: InputObject) => {
					if (state === Enum.UserInputState.Begin) {
						ClientOnStart(player);
						link.FireServer(actionName, false);
					} else if (state === Enum.UserInputState.End && ClientOnEnd) {
						ClientOnEnd(player);
						link.FireServer(actionName, true);
					}
				};

				// Bind the action to ContextActionService
				ContextActionService.BindAction(Name, ClientWrap, TouchButton || false, Gesture);
			}
		});

		// Connect to UserInputService only once for all UserInput actions
		UserInputService.InputBegan.Connect((input: InputObject, gameProcessed: boolean) => {
			if (gameProcessed) return;

			this.actions.forEach((action) => {
				const { Name, InputMethod, Gesture, ClientOnStart } = action;
				const isGesture =
					input.KeyCode.Name.lower() === Gesture.Name.lower() ||
					input.UserInputType.Name.lower() === Gesture.Name.lower();

				if (InputMethod === "UserInput" && isGesture) {
					ClientOnStart(player);
					link.FireServer(Name, false);
				}
			});
		});

		UserInputService.InputEnded.Connect((input: InputObject, gameProcessed: boolean) => {
			if (gameProcessed) return;

			this.actions.forEach((action) => {
				const { Name, InputMethod, Gesture, ClientOnEnd } = action;
				const isGesture =
					input.KeyCode.Name.lower() === Gesture.Name.lower() ||
					input.UserInputType.Name.lower() === Gesture.Name.lower();

				if (InputMethod === "UserInput" && ClientOnEnd && isGesture) {
					ClientOnEnd(player);
					link.FireServer(Name, true);
				}
			});
		});
	}

	StartServer() {
		if (!RunService.IsServer()) error("Must be called from the server!");
		const link = this.link;
		if (!link) error("No link event found.");

		link.OnServerEvent.Connect((player, actionName, ended) => {
			if (!typeIs(actionName, "string")) error("actionName must be a string");

			const action = this.actions.get(actionName.lower());
			if (action) {
				const { Name, ServerOnStart, ServerOnEnd } = action;

				if (Name.lower() === Name.lower()) {
					if (!ended) {
						ServerOnStart(player);
					} else if (ended && ServerOnEnd) {
						ServerOnEnd(player);
					}
				}
			}
		});
	}
}

const simpleAction = new SimpleAction();
export default simpleAction;
