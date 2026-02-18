import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createProductGroup } from "../../../services/productsApi";

export function useProductFormMutations() {
  const queryClient = useQueryClient();

  const createProductGroupMutation = useMutation({
    mutationFn: createProductGroup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-groups"] });
    },
  });

  return {
    createProductGroupMutation,
  };
}
