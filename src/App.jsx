import Layout from "./components/Layout";
import CreateProposalModal from "./components/CreateProposalModal";
import Proposals from "./components/Proposals";
import useContract from "./hooks/useContract";
import { useCallback, useEffect, useState } from "react";
import { Contract } from "ethers";
import useRunners from "./hooks/useRunners";
import { Interface } from "ethers";
import ABI from "./ABI/proposal.json";
import { Modal } from "./components/Modal";

const multicallAbi = [
  "function tryAggregate(bool requireSuccess, (address target, bytes callData)[] calls) returns ((bool success, bytes returnData)[] returnData)",
];
function App() {
  const readOnlyProposalContract = useContract(true);
  const { readOnlyProvider } = useRunners();
  const [proposals, setProposals] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProposals = useCallback(async () => {
    if (!readOnlyProposalContract) return;

    const multicallContract = new Contract(
      import.meta.env.VITE_MULTICALL_ADDRESS,
      multicallAbi,
      readOnlyProvider
    );

    const itf = new Interface(ABI);

    try {
      const proposalCount = Number(
        await readOnlyProposalContract.proposalCount()
      );

      const proposalsIds = Array.from(
        { length: proposalCount - 1 },
        (_, i) => i + 1
      );

      const calls = proposalsIds.map((id) => ({
        target: import.meta.env.VITE_CONTRACT_ADDRESS,
        callData: itf.encodeFunctionData("proposals", [id]),
      }));

      const responses = await multicallContract.tryAggregate.staticCall(
        true,
        calls
      );

      const decodedResults = responses.map((res) =>
        itf.decodeFunctionResult("proposals", res.returnData)
      );

      const data = decodedResults.map((proposalStruct) => ({
        description: proposalStruct.description,
        amount: proposalStruct.amount,
        minRequiredVote: proposalStruct.minVotesToPass,
        votecount: proposalStruct.voteCount,
        deadline: proposalStruct.votingDeadline,
        executed: proposalStruct.executed,
      }));

      setProposals(data);
    } catch (error) {
      console.log("error fetching proposals: ", error);
    }
  }, [readOnlyProposalContract, readOnlyProvider]);

  useEffect(() => {
    fetchProposals();

    const contract = new Contract(
      import.meta.env.VITE_CONTRACT_ADDRESS,
      ABI,
      readOnlyProvider
    );

    contract.on("ProposalCreated", () => {
      fetchProposals();
    });

    contract.on("Voted", () => {
      fetchProposals();
    });

    return () => {
      contract.removeAllListeners("ProposalCreated");
      contract.removeAllListeners("Voted");
    };
  }, [fetchProposals, readOnlyProvider]);

  return (
    <Layout>
      <div className="w-full flex my-5">
        <button
          className="bg-blue-500 p-4 text-white shadow-md rounded-md"
          onClick={() => setIsModalOpen(true)}
        >
          Create Proposal
        </button>
      </div>
      <Modal
        handleClose={() => setIsModalOpen(false)}
        isOpen={isModalOpen}
        isSuccessModal
        title="Create Proposal"
      >
        <CreateProposalModal
          closeModal={() => setIsModalOpen(false)}
          refetch={fetchProposals}
        />
      </Modal>
      <Proposals proposals={proposals} />
    </Layout>
  );
}

export default App;
