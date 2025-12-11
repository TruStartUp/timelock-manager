import React, { useMemo, useState, useEffect } from 'react'
import { isAddress, type Address } from 'viem'
import { useContractABI } from '@/hooks/useContractABI'

const NewProposalView: React.FC = () => {
  // State for wizard steps
  const [currentStep, setCurrentStep] = useState(1)
  const [contractAddress, setContractAddress] = useState('')
  const [addressToFetch, setAddressToFetch] = useState<Address | undefined>()
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState(
    'transfer(address to, uint256 amount)'
  )
  const [functionParams, setFunctionParams] = useState({
    to: '',
    amount: '',
  })

  const {
    abi,
    isProxy,
    implementationAddress,
    source,
    confidence,
    isLoading: isAbiLoading,
    isError: isAbiError,
    error: abiError,
    refetch: refetchABI,
  } = useContractABI(addressToFetch, {
    enabled: !!addressToFetch,
  })

  // Trigger refetch when addressToFetch changes (user clicked Fetch ABI)
  useEffect(() => {
    if (addressToFetch && hasAttemptedFetch) {
      refetchABI()
    }
  }, [addressToFetch, hasAttemptedFetch, refetchABI])

  const functionCount = useMemo(() => {
    if (!abi || abi.length === 0) return 0
    return abi.filter((item: any) => item?.type === 'function').length
  }, [abi])

  // Handler for Fetch ABI button
  const handleFetchAbi = () => {
    setFetchError(null)
    setHasAttemptedFetch(true)

    if (
      !contractAddress ||
      !isAddress(contractAddress, {
        // Rootstock in-the-wild addresses are often not checksummed; accept and normalize.
        strict: false,
      })
    ) {
      setFetchError('Please enter a valid contract address (0x...)')
      setAddressToFetch(undefined)
      return
    }

    const normalized = contractAddress.trim().replace(/^0X/, '0x').toLowerCase()
    setAddressToFetch(normalized as Address)
  }

  // Handler for Back button
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Handler for Next button
  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  // Handler for function parameter changes
  const handleParamChange = (paramName: string, value: string) => {
    setFunctionParams({
      ...functionParams,
      [paramName]: value,
    })
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar: Navigation */}
      <aside className="w-1/4 max-w-xs border-r border-border-color p-6 flex flex-col justify-between">
        <div className="flex flex-col gap-8">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBWaww7Ase0LARJ6q1ZlweOp1ATe5nFhCQjJagkub_u927EOx9NvpXzutPwmG5St-SABddukU0CGylN8FxfSoB85aYDdwm_Ga9zONHaQICuUiMV-D0UQdwvFdEIpVAUOoUq3pbYJ_XpF_yauLWrGJxWsqRqqe5Zti4BHub8KZnQyOYU0eraKXJ5K1JqdZnMDCCww5W_Ztasa8JssQ7YvnuTYXkPPV6RgSG0M2oPxWVKLR7tpVM55SxWE4NONirExGNkIo6nrpqqQTwP")',
              }}
            ></div>
            <div className="flex flex-col">
              <h1 className="text-text-primary text-base font-medium leading-normal">
                Timelock Wizard
              </h1>
              <p className="text-text-secondary text-sm font-normal leading-normal">
                Schedule a new operation
              </p>
            </div>
          </div>

          {/* Navigation Steps */}
          <nav className="flex flex-col gap-2">
            <a
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                currentStep === 1 ? 'bg-primary/20' : ''
              }`}
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setCurrentStep(1)
              }}
            >
              <span
                className={`material-symbols-outlined text-2xl ${
                  currentStep === 1 ? 'text-primary' : 'text-text-primary'
                }`}
              >
                target
              </span>
              <p
                className={`text-sm leading-normal ${
                  currentStep === 1
                    ? 'text-primary font-bold'
                    : 'text-text-primary font-medium'
                }`}
              >
                1. Target
              </p>
            </a>
            <a
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                currentStep === 2 ? 'bg-primary/20' : ''
              }`}
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setCurrentStep(2)
              }}
            >
              <span
                className={`material-symbols-outlined text-2xl ${
                  currentStep === 2 ? 'text-primary' : 'text-text-primary'
                }`}
              >
                code
              </span>
              <p
                className={`text-sm leading-normal ${
                  currentStep === 2
                    ? 'text-primary font-bold'
                    : 'text-text-primary font-medium'
                }`}
              >
                2. Function
              </p>
            </a>
            <a
              className={`flex items-center gap-3 px-3 py-2 rounded-full ${
                currentStep === 3 ? 'bg-primary/20' : ''
              }`}
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setCurrentStep(3)
              }}
            >
              <span
                className={`material-symbols-outlined text-2xl ${
                  currentStep === 3 ? 'text-primary' : 'text-text-primary'
                }`}
              >
                visibility
              </span>
              <p
                className={`text-sm leading-normal ${
                  currentStep === 3
                    ? 'text-primary font-bold'
                    : 'text-text-primary font-medium'
                }`}
              >
                3. Review
              </p>
            </a>
          </nav>
        </div>

        {/* Help Section */}
        <div className="flex flex-col gap-4 p-4 bg-surface rounded border border-border-color">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-text-secondary">
              help
            </span>
            <h3 className="text-sm font-bold text-text-primary">Need help?</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            Refer to the documentation for detailed instructions on scheduling
            operations.
          </p>
          <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-background border border-border-color text-text-primary text-sm font-medium leading-normal tracking-[0.015em] hover:bg-border-color transition-colors">
            <span className="truncate">View Docs</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 lg:p-16">
        <div className="mx-auto flex h-full max-w-4xl flex-col">
          {/* Step 1: Target Contract */}
          {currentStep >= 1 && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
                  Step 1: Select Target Contract
                </p>
                <p className="text-text-secondary text-base font-normal leading-normal">
                  Enter the address of the contract you wish to interact with
                  and fetch its ABI.
                </p>
              </div>
              <div className="flex flex-col gap-4 rounded-lg border border-border-color bg-surface p-6">
                <label className="flex flex-col w-full">
                  <p className="text-text-primary text-base font-medium leading-normal pb-2">
                    Target Contract Address
                  </p>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                    placeholder="0x..."
                    type="text"
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                  />
                </label>
                <div className="flex items-center gap-4">
                  <button
                    className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleFetchAbi}
                    disabled={isAbiLoading}
                  >
                    <span className="truncate">Fetch ABI</span>
                  </button>
                  {isAbiLoading && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                      <p>Fetching ABI…</p>
                    </div>
                  )}
                  {!isAbiLoading &&
                    !isAbiError &&
                    hasAttemptedFetch &&
                    addressToFetch &&
                    abi.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-green-500">
                        <span className="material-symbols-outlined text-base">
                          task_alt
                        </span>
                        <p>
                          ABI loaded ({functionCount} functions) • {source} •{' '}
                          {confidence}
                          {isProxy && implementationAddress
                            ? ` • Proxy → ${implementationAddress.slice(0, 10)}...${implementationAddress.slice(-8)}`
                            : ''}
                        </p>
                      </div>
                    )}
                  {!isAbiLoading &&
                    !isAbiError &&
                    hasAttemptedFetch &&
                    addressToFetch &&
                    abi.length === 0 && (
                      <div className="flex items-center gap-2 text-sm text-yellow-500">
                        <span className="material-symbols-outlined text-base">
                          warning
                        </span>
                        <p>
                          No ABI found. Contract may be unverified. You can
                          manually enter the ABI.
                        </p>
                      </div>
                    )}
                </div>
                {(fetchError || (isAbiError && abiError)) && (
                  <div className="text-sm text-red-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">
                      error
                    </span>
                    <p>{fetchError || abiError || 'Failed to fetch ABI'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Configure Function */}
          {currentStep >= 2 && (
            <div className="mt-16 flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
                  Step 2: Configure Function Call
                </p>
                <p className="text-text-secondary text-base font-normal leading-normal">
                  Select a function from the ABI and provide the required
                  arguments.
                </p>
              </div>
              <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
                <div className="flex flex-col w-full">
                  <p className="text-text-primary text-base font-medium leading-normal pb-2">
                    Select Function
                  </p>
                  <div className="relative w-full">
                    <select
                      className="form-select w-full appearance-none rounded border border-border-color bg-background p-4 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={selectedFunction}
                      onChange={(e) => setSelectedFunction(e.target.value)}
                    >
                      <option>transfer(address to, uint256 amount)</option>
                      <option>setOwner(address newOwner)</option>
                      <option>approve(address spender, uint256 amount)</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
                      unfold_more
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <label className="flex flex-col w-full">
                    <p className="text-text-primary text-base font-medium leading-normal pb-2">
                      to (address)
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                      placeholder="0x..."
                      type="text"
                      value={functionParams.to}
                      onChange={(e) => handleParamChange('to', e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col w-full">
                    <p className="text-text-primary text-base font-medium leading-normal pb-2">
                      amount (uint256)
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                      placeholder="1000000000000000000"
                      type="text"
                      value={functionParams.amount}
                      onChange={(e) =>
                        handleParamChange('amount', e.target.value)
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-start gap-4">
                <button
                  className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-surface text-text-primary text-sm font-medium leading-normal tracking-[0.015em] border border-border-color hover:bg-border-color transition-colors"
                  onClick={handleBack}
                >
                  <span className="truncate">Back</span>
                </button>
                <button
                  className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors"
                  onClick={handleNext}
                >
                  <span className="truncate">Next: Review</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default NewProposalView
