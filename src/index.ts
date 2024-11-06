import { ContextActionService, ReplicatedStorage, RunService } from "@rbxts/services";

type ActionType = {
	Name: string;
	Gesture: Enum.KeyCode | Enum.UserInputType;
	Client: () => void;
	Server: (player: Player) => void;
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
		this.actions.forEach((action) => {
			const { Name, Gesture, Client, TouchButton } = action;
			ContextActionService.BindAction(Name, Client, TouchButton || false, Gesture);
		});
	}

	StartServer(player: Player) {}
}

const simpleInput = new SimpleAction();
export = simpleInput;
