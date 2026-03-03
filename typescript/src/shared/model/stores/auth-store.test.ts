import type { User } from "@/shared/model/types/user";
import { useAuthStore } from "./auth-store";

const TEST_USER: User = {
  id: "u-1",
  username: "alice",
  displayName: "alice",
  avatar: null,
  status: "online",
  customStatus: null,
  bot: false,
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: null,
      status: "online",
      customStatus: null,
    });
  });

  it("setCurrentUser supports clearing current user", () => {
    const { setCurrentUser } = useAuthStore.getState();

    setCurrentUser(TEST_USER);
    expect(useAuthStore.getState().currentUser).toEqual(TEST_USER);

    setCurrentUser(null);
    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});
