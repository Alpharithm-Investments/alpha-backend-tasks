import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { FakeAuthGuard } from "./fake-auth.guard";

describe("FakeAuthGuard", () => {
  let guard: FakeAuthGuard;
  let context: Partial<ExecutionContext>;
  let request: any;

  beforeEach(() => {
    guard = new FakeAuthGuard();
    request = {
      header: jest.fn(),
      user: undefined,
    };

    context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  });

  it("should throw if headers missing", () => {
    request.header.mockImplementation((name: string) => null);

    expect(() => guard.canActivate(context as ExecutionContext)).toThrow(
      UnauthorizedException,
    );
  });

  it("should attach user when headers present", () => {
    request.header.mockImplementation((name: string) => {
      if (name === "x-user-id") return "user-123";
      if (name === "x-workspace-id") return "workspace-abc";
      return null;
    });

    const result = guard.canActivate(context as ExecutionContext);
    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: "user-123",
      workspaceId: "workspace-abc",
    });
  });
});
