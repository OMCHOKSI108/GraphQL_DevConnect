import { login, register } from "./auth.service.js";

export const authResolver = {
  Mutation: {
    register: async (
      _parent: unknown,
      args: { input: { name: string; email: string; password: string; skills: string[] } }
    ) => {
      return register(args.input);
    },

    login: async (_parent: unknown, args: { input: { email: string; password: string } }) => {
      return login(args.input);
    }
  }
};
