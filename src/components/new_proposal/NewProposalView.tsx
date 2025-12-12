import React, { useMemo, useState, useEffect } from 'react'
import {
  BaseError,
  ContractFunctionRevertedError,
  isAddress,
  type Address,
  encodeFunctionData,
  keccak256,
  toBytes,
} from 'viem'
import { useAccount } from 'wagmi'
import { useContractABI } from '@/hooks/useContractABI'
import { useTimelockWrite } from '@/hooks/useTimelockWrite'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { parseABITypeToZod } from '@/lib/validation'

const NewProposalView: React.FC = () => {
  // State for wizard steps
  const [currentStep, setCurrentStep] = useState(1)
  const [contractAddress, setContractAddress] = useState('')
  const [addressToFetch, setAddressToFetch] = useState<Address | undefined>()
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false)
  // Keep empty by default so we can auto-select the first available write function once ABI loads.
  const [selectedFunction, setSelectedFunction] = useState('')

  // T061: State to store fetched ABI result persistently across steps
  const [fetchedABIData, setFetchedABIData] = useState<{
    abi: unknown[]
    source: string
    confidence: string
    isProxy: boolean
    implementationAddress?: Address
  } | null>(null)

  // T062: State for manual ABI modal
  const [showManualABIModal, setShowManualABIModal] = useState(false)
  const [manualABIInput, setManualABIInput] = useState('')
  const [manualABIError, setManualABIError] = useState<string | null>(null)

  // T065: Step 3 review state
  const [operationParams, setOperationParams] = useState({
    delay: '', // in seconds
    timelockController: '', // contract that schedules the operation
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    salt: '' as `0x${string}`, // will generate random
  })
  // T066: High-risk confirmation gate
  const [confirmText, setConfirmText] = useState('')
  const [reviewData, setReviewData] = useState<{
    functionName: string
    signature: string
    argsByName: Record<string, unknown>
    argsInOrder: unknown[]
    calldata: `0x${string}` | null
  } | null>(null)

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

  // T065: Get connected wallet address
  const { address: connectedAddress } = useAccount()

  const normalizeBytes32 = (value: string): `0x${string}` => {
    const v = value.trim().replace(/^0X/, '0x').toLowerCase()
    if (!v.startsWith('0x')) return `0x${value}` as `0x${string}`
    const hex = v.slice(2).replace(/[^0-9a-f]/g, '')
    const padded = hex.padStart(64, '0').slice(-64)
    return (`0x${padded}`) as `0x${string}`
  }

  const normalizedTimelockController = useMemo(() => {
    const v = operationParams.timelockController.trim()
    if (!v) return undefined
    if (
      !isAddress(v, {
        // Rootstock addresses may not be checksummed; accept and normalize.
        strict: false,
      })
    ) {
      return undefined
    }
    return v.trim().replace(/^0X/, '0x').toLowerCase() as Address
  }, [operationParams.timelockController])

  // TimelockController address used to query minDelay and schedule operations.
  // Note: Step 1 is the *target contract* for ABI. TimelockController is a separate contract.
  const timelockAddress = (normalizedTimelockController ||
    '0x0000000000000000000000000000000000000000') as Address

  const {
    schedule,
    isPending,
    isSuccess,
    isError: isScheduleError,
    error: scheduleError,
    txHash,
    minDelay,
    hasProposerRole,
    reset: resetSchedule,
  } = useTimelockWrite({
    timelockController: timelockAddress,
    account: connectedAddress,
  })

  const [submitError, setSubmitError] = useState<string | null>(null)

  // Trigger refetch when addressToFetch changes (user clicked Fetch ABI)
  useEffect(() => {
    if (addressToFetch && hasAttemptedFetch) {
      refetchABI()
    }
  }, [addressToFetch, hasAttemptedFetch, refetchABI])

  // T061: Store successful ABI fetch for use in later steps
  useEffect(() => {
    if (abi && abi.length > 0 && !isAbiLoading && !isAbiError) {
      setFetchedABIData({
        abi,
        source: source || 'unknown',
        confidence: confidence || 'low',
        isProxy: isProxy || false,
        implementationAddress,
      })

      // UX: after an explicit Fetch ABI succeeds, automatically advance to Step 2.
      if (hasAttemptedFetch && currentStep === 1) {
        setCurrentStep(2)
      }
    } else if (
      !isAbiLoading &&
      hasAttemptedFetch &&
      addressToFetch &&
      (!abi || abi.length === 0)
    ) {
      // T062: Unverified contract - show manual ABI modal
      setShowManualABIModal(true)
    }
  }, [
    abi,
    source,
    confidence,
    isProxy,
    implementationAddress,
    isAbiLoading,
    isAbiError,
    hasAttemptedFetch,
    addressToFetch,
    currentStep,
  ])

  const functionCount = useMemo(() => {
    if (!abi || abi.length === 0) return 0
    return abi.filter((item: any) => item?.type === 'function').length
  }, [abi])

  // T064: Extract all functions from ABI for function selector dropdown
  const availableFunctions = useMemo(() => {
    if (!fetchedABIData || !fetchedABIData.abi) return []

    return fetchedABIData.abi
      // Only allow write functions for proposal scheduling (T063):
      // - Exclude read-only functions (view/pure)
      .filter((item: any) => {
        if (item?.type !== 'function') return false
        const mutability = item?.stateMutability
        return mutability !== 'view' && mutability !== 'pure'
      })
      .map((func: any) => {
        // Generate function signature: "functionName(type1,type2,...)"
        const params =
          func.inputs?.map((input: any) => input.type).join(',') || ''
        const signature = `${func.name}(${params})`

        return {
          name: func.name,
          signature,
          inputs: func.inputs || [],
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
  }, [fetchedABIData])

  // T064: Auto-select first function when ABI loads
  useEffect(() => {
    if (availableFunctions.length > 0 && !selectedFunction) {
      setSelectedFunction(availableFunctions[0].signature)
    }
  }, [availableFunctions, selectedFunction])

  // T063: Parse selected function from ABI
  const selectedFunctionABI = useMemo(() => {
    if (!fetchedABIData || !fetchedABIData.abi) return null
    if (!selectedFunction) return null

    // Extract function name + type list from selectedFunction (e.g., "transfer(address,uint256)")
    const match = selectedFunction.match(/^([^(]+)\((.*)\)$/)
    if (!match) return null
    const functionName = match[1]
    const typeList = match[2] ?? ''
    const normalizedTypeList = typeList
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(',')

    return fetchedABIData.abi.find(
      (item: any) => {
        if (item?.type !== 'function') return false

        // Match function name and full input type list to handle overloads.
        const itemTypeList = (item?.inputs ?? [])
          .map((input: any) => input?.type)
          .filter(Boolean)
          .join(',')

        // Only allow write functions (T063)
        const mutability = item?.stateMutability
        const isWrite = mutability !== 'view' && mutability !== 'pure'

        return (
          isWrite &&
          item?.name === functionName &&
          itemTypeList === normalizedTypeList
        )
      }
    )
  }, [fetchedABIData, selectedFunction])

  const isHighRiskFunction = useMemo(() => {
    const fromReview = (reviewData?.functionName || '').toString()
    const fromSelected = selectedFunction ? selectedFunction.split('(')[0] : ''
    const name = (fromReview || fromSelected).toLowerCase()
    return (
      name === 'upgradeto' ||
      name === 'transferownership' ||
      name === 'setadmin' ||
      name === 'updatedelay'
    )
  }, [reviewData?.functionName, selectedFunction])

  // T063: Generate Zod schema from function inputs
  const functionFormSchema = useMemo(() => {
    if (!selectedFunctionABI || !(selectedFunctionABI as any).inputs) {
      return z.object({})
    }

    const schemaFields: Record<string, z.ZodTypeAny> = {}
    const inputs = (selectedFunctionABI as any).inputs

    inputs.forEach((input: any) => {
      const inputName = input.name || `param${input.index || 0}`
      const inputType = input.type

      try {
        schemaFields[inputName] = parseABITypeToZod(inputType)
      } catch (err) {
        console.warn(`Failed to parse type ${inputType} for ${inputName}:`, err)
        // Fallback to string validation
        schemaFields[inputName] = z.string()
      }
    })

    return z.object(schemaFields)
  }, [selectedFunctionABI])

  // T063: Initialize form with Zod validation
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(functionFormSchema),
    defaultValues: {},
  })

  // T063: Reset form when function changes
  useEffect(() => {
    if (selectedFunctionABI && (selectedFunctionABI as any).inputs) {
      const defaultValues: Record<string, string> = {}
      const inputs = (selectedFunctionABI as any).inputs
      inputs.forEach((input: any) => {
        const inputName = input.name || `param${input.index || 0}`
        defaultValues[inputName] = ''
      })
      reset(defaultValues)
    }
  }, [selectedFunctionABI, reset])

  // T063: Helper to generate appropriate placeholder based on Solidity type
  const getPlaceholderForType = (type: string): string => {
    if (type.startsWith('uint') || type.startsWith('int')) {
      return '123'
    } else if (type === 'address') {
      return '0x...'
    } else if (type.startsWith('bytes')) {
      return '0x1234...'
    } else if (type === 'bool') {
      return 'true or false'
    } else if (type === 'string') {
      return 'Enter text'
    } else {
      return `Enter ${type} value`
    }
  }

  // Handler for Fetch ABI button
  const handleFetchAbi = () => {
    setFetchError(null)
    setHasAttemptedFetch(true)
    setFetchedABIData(null) // T061: Reset ABI data on new fetch

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

  const handleSubmitSchedule = () => {
    setSubmitError(null)

    if (!hasProposerRole) {
      setSubmitError('Your wallet does not have the PROPOSER_ROLE.')
      return
    }

    if (
      !contractAddress ||
      !isAddress(contractAddress, {
        strict: false,
      })
    ) {
      setSubmitError('Enter a valid target contract address (Step 1).')
      return
    }

    if (!normalizedTimelockController) {
      setSubmitError('Enter a valid Timelock Controller address.')
      return
    }

    // Wait for minDelay to be fetched so we can validate before submitting.
    if (typeof minDelay !== 'bigint') {
      setSubmitError('Fetching contract minDelay… please wait.')
      return
    }

    if (!reviewData?.calldata) {
      setSubmitError('Unable to encode calldata. Please review your inputs.')
      return
    }

    let delay: bigint
    try {
      delay = BigInt(operationParams.delay)
    } catch {
      setSubmitError('Delay must be a valid integer (in seconds).')
      return
    }

    if (typeof minDelay === 'bigint' && delay < minDelay) {
      setSubmitError(
        `Delay must be at least the contract minimum (${minDelay.toString()}s).`
      )
      return
    }

    // Single-call scheduling (T067)
    schedule({
      target: contractAddress.trim().replace(/^0X/, '0x').toLowerCase() as Address,
      value: BigInt(0),
      data: reviewData.calldata,
      predecessor: operationParams.predecessor,
      salt: operationParams.salt,
      delay,
    })
  }

  // Handler for Next button
  const handleNext = () => {
    if (currentStep === 2) {
      // T065: Moving from Step 2 to Step 3 - validate form and prepare operation
      handleSubmit((data) => {
        // data contains validated form values

        // Generate random salt if not set
        if (!operationParams.salt) {
          const randomSalt = keccak256(
            toBytes(
              `${Date.now()}-${Math.random()}-${connectedAddress || 'unknown'}`
            )
          ) as `0x${string}`
          setOperationParams(prev => ({
            ...prev,
            salt: normalizeBytes32(randomSalt),
          }))
        }

        // Persist validated args for Step 3 review
        const fnName = (selectedFunctionABI as any)?.name as string | undefined
        const inputs = ((selectedFunctionABI as any)?.inputs ?? []) as any[]
        const argsInOrder: unknown[] = inputs.map((input: any, index: number) => {
          const inputName = input?.name || `param${index}`
          const inputType = input?.type as string | undefined
          const raw = (data as any)?.[inputName]
          if (typeof raw !== 'string' || !inputType) return raw

          // Minimal coercion for encoding:
          // - uint/int -> bigint
          // - bool -> boolean (supports 'true'/'false')
          if (inputType.startsWith('uint') || inputType.startsWith('int')) {
            try {
              return BigInt(raw)
            } catch {
              return raw
            }
          }
          if (inputType === 'bool') {
            if (raw === 'true') return true
            if (raw === 'false') return false
            return raw
          }
          return raw
        })

        let calldata: `0x${string}` | null = null
        try {
          if (selectedFunctionABI && fnName) {
            calldata = encodeFunctionData({
              // Use only the selected function ABI to avoid overload ambiguity
              abi: [selectedFunctionABI as any],
              functionName: fnName,
              args: argsInOrder as any,
            }) as `0x${string}`
          }
        } catch (err) {
          console.warn('Failed to encode calldata for review:', err)
        }

        setReviewData({
          functionName: fnName || selectedFunction.split('(')[0],
          signature: selectedFunction,
          argsByName: data as Record<string, unknown>,
          argsInOrder,
          calldata,
        })

        setCurrentStep(3)
      })()
    } else if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  // T062: Handler for manual ABI submission
  const handleManualABISubmit = () => {
    setManualABIError(null)

    try {
      // Parse and validate JSON
      const parsedABI = JSON.parse(manualABIInput)

      // Validate it's an array
      if (!Array.isArray(parsedABI)) {
        setManualABIError('ABI must be a JSON array')
        return
      }

      // Validate it contains function entries
      const hasFunctions = parsedABI.some(
        (item: any) => item?.type === 'function'
      )
      if (!hasFunctions) {
        setManualABIError('ABI must contain at least one function definition')
        return
      }

      // Store manual ABI in state
      setFetchedABIData({
        abi: parsedABI,
        source: 'manual',
        confidence: 'high',
        isProxy: false,
      })

      // Store in sessionStorage for caching (as per useContractABI behavior)
      if (addressToFetch && typeof window !== 'undefined') {
        try {
          const cache = JSON.parse(sessionStorage.getItem('abiCache') || '{}')
          cache[addressToFetch] = {
            abi: parsedABI,
            source: 'manual',
            confidence: 'high',
            isProxy: false,
            fetchedAt: new Date().toISOString(),
            ttl: 24 * 60 * 60, // 24 hours
          }
          sessionStorage.setItem('abiCache', JSON.stringify(cache))
        } catch (err) {
          console.warn('Failed to cache manual ABI:', err)
        }
      }

      // Close modal and clear input
      setShowManualABIModal(false)
      setManualABIInput('')
    } catch (err) {
      setManualABIError(
        err instanceof Error ? err.message : 'Invalid JSON format'
      )
    }
  }

  const friendlyScheduleError = useMemo(() => {
    if (!scheduleError) return null

    const base = scheduleError as unknown
    if (!(base instanceof BaseError)) {
      return scheduleError instanceof Error ? scheduleError.message : String(scheduleError)
    }

    // Try to decode a contract revert (custom errors are present in TimelockController ABI)
    const revert = base.walk(
      (err) => err instanceof ContractFunctionRevertedError
    ) as ContractFunctionRevertedError | undefined

    if (revert instanceof ContractFunctionRevertedError) {
      const errorName = (revert.data as any)?.errorName as string | undefined
      const args = (revert.data as any)?.args as unknown[] | undefined

      if (errorName === 'TimelockInsufficientDelay') {
        const [delayArg, minDelayArg] = (args ?? []) as [bigint?, bigint?]
        return `Delay is too small. Provided ${
          delayArg !== undefined ? delayArg.toString() : '—'
        }s, but the contract requires at least ${
          minDelayArg !== undefined ? minDelayArg.toString() : '—'
        }s.`
      }

      if (errorName === 'TimelockUnauthorizedCaller') {
        return 'Unauthorized caller. Your wallet likely does not have PROPOSER_ROLE on this TimelockController.'
      }

      if (errorName) {
        return `Transaction reverted: ${errorName}`
      }
    }

    return base.shortMessage || base.message
  }, [scheduleError])

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
          {currentStep === 1 && (
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
          {currentStep === 2 && (
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

              {/* T064: Show warning if no ABI loaded */}
              {!fetchedABIData ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
                  <p className="text-yellow-400 text-base">
                    Please complete Step 1 to fetch the contract ABI before configuring
                    the function call.
                  </p>
                </div>
              ) : (
                <>
              <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
                <div className="flex flex-col w-full">
                  <p className="text-text-primary text-base font-medium leading-normal pb-2">
                    Select Function
                  </p>
                  <div className="relative w-full">
                    <select
                      className="form-select w-full appearance-none rounded border border-border-color bg-background h-14 py-[15px] pl-[15px] pr-12 text-text-primary text-base font-normal leading-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={selectedFunction}
                      onChange={(e) => setSelectedFunction(e.target.value)}
                      disabled={availableFunctions.length === 0}
                    >
                      {availableFunctions.length === 0 ? (
                        <option>No functions available</option>
                      ) : (
                        availableFunctions.map((func) => (
                          <option key={func.signature} value={func.signature}>
                            {func.signature}
                          </option>
                        ))
                      )}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
                      unfold_more
                    </span>
                  </div>
                </div>

                {/* T063: Dynamic parameter inputs based on selected function */}
                {selectedFunctionABI && (selectedFunctionABI as any).inputs && (selectedFunctionABI as any).inputs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {(selectedFunctionABI as any).inputs.map((input: any, index: number) => {
                      const inputName = input.name || `param${index}`
                      const inputType = input.type
                      const fieldError = (errors as any)[inputName]

                      return (
                        <Controller
                          key={`${selectedFunction}-${inputName}-${index}`}
                          name={inputName as any}
                          control={control as any}
                          render={({ field }) => (
                            <label className="flex flex-col w-full">
                              <p className="text-text-primary text-base font-medium leading-normal pb-2">
                                {inputName} ({inputType})
                              </p>
                              <input
                                {...field}
                                value={field.value ?? ''}
                                className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border ${
                                  fieldError
                                    ? 'border-red-500'
                                    : 'border-border-color'
                                } bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal`}
                                placeholder={getPlaceholderForType(inputType)}
                                type="text"
                              />
                              {fieldError && (
                                <p className="text-red-400 text-sm mt-1">
                                  {fieldError?.message as string}
                                </p>
                              )}
                            </label>
                          )}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="bg-background rounded p-6 text-center">
                    <p className="text-text-secondary">
                      {selectedFunctionABI
                        ? 'This function has no parameters'
                        : 'Select a function to configure parameters'}
                    </p>
                  </div>
                )}
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
              </>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <div className="mt-16 flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
                  Step 3: Review Operation
                </p>
                <p className="text-text-secondary text-base font-normal leading-normal">
                  Review the operation details before scheduling.
                </p>
              </div>

              <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
                <div className="flex flex-col gap-2">
                  <p className="text-text-primary text-base font-medium leading-normal">
                    Summary
                  </p>
                  <p className="text-text-secondary text-sm leading-normal wrap-break-word">
                    {contractAddress || '0x…'}.{reviewData?.signature || '…'}
                  </p>
                </div>

                {/* T066: High-risk confirmation gate */}
                {isHighRiskFunction && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm font-medium">
                      High-risk function detected
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                      This function is commonly used for upgrades/admin changes.
                      To proceed, type <span className="font-mono">CONFIRM</span>{' '}
                      below.
                    </p>
                    <label className="flex flex-col mt-4">
                      <span className="text-text-primary text-sm font-medium pb-2">
                        Type CONFIRM to enable Submit
                      </span>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-yellow-500/40 bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal font-mono"
                        placeholder="CONFIRM"
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                      />
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <label className="flex flex-col w-full">
                    <p className="text-text-primary text-base font-medium leading-normal pb-2">
                      Timelock Controller Address
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                      placeholder="0x..."
                      type="text"
                      value={operationParams.timelockController}
                      onChange={(e) =>
                        setOperationParams((prev) => ({
                          ...prev,
                          timelockController: e.target.value,
                        }))
                      }
                    />
                    <p className="text-text-secondary text-xs mt-2">
                      This is the contract that enforces <code>minDelay</code> and
                      calls <code>schedule()</code>.
                    </p>
                    {operationParams.timelockController.trim().length > 0 &&
                      !normalizedTimelockController && (
                        <p className="text-red-400 text-xs mt-2">
                          Enter a valid address to fetch contract minDelay.
                        </p>
                      )}
                  </label>

                  <label className="flex flex-col w-full">
                    <p className="text-text-primary text-base font-medium leading-normal pb-2">
                      Delay (seconds)
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                      placeholder="e.g. 86400"
                      type="text"
                      value={operationParams.delay}
                      onChange={(e) =>
                        setOperationParams((prev) => ({
                          ...prev,
                          delay: e.target.value,
                        }))
                      }
                    />
                    <p className="text-text-secondary text-xs mt-2">
                      Contract minDelay:{' '}
                      {!normalizedTimelockController
                        ? '—'
                        : typeof minDelay === 'bigint'
                          ? `${minDelay.toString()}s`
                          : 'Fetching…'}
                    </p>
                  </label>

                  <label className="flex flex-col w-full md:col-span-2">
                    <p className="text-text-primary text-base font-medium leading-normal pb-2">
                      Salt (bytes32)
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal font-mono"
                      placeholder="0x0000000000000000000000000000000000000000000000000000000000000000"
                      type="text"
                      value={operationParams.salt}
                      onChange={(e) =>
                        setOperationParams((prev) => ({
                          ...prev,
                          salt: normalizeBytes32(e.target.value),
                        }))
                      }
                    />
                  </label>

                  <label className="flex flex-col w-full md:col-span-2">
                    <p className="text-text-primary text-base font-medium leading-normal pb-2">
                      Predecessor (bytes32)
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal font-mono"
                      placeholder="0x0000000000000000000000000000000000000000000000000000000000000000"
                      type="text"
                      value={operationParams.predecessor}
                      onChange={(e) =>
                        setOperationParams((prev) => ({
                          ...prev,
                          predecessor: normalizeBytes32(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>

                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                    <p className="text-red-400 text-sm">{submitError}</p>
                  </div>
                )}
                {isScheduleError && scheduleError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                    <p className="text-red-400 text-sm">
                      {friendlyScheduleError || 'Scheduling failed'}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <p className="text-text-primary text-base font-medium leading-normal">
                    Parameters (decoded)
                  </p>
                  {selectedFunctionABI &&
                  (selectedFunctionABI as any).inputs &&
                  (selectedFunctionABI as any).inputs.length > 0 ? (
                    <div className="rounded border border-border-color bg-background">
                      <div className="grid grid-cols-3 gap-2 border-b border-border-color px-4 py-3 text-xs text-text-secondary">
                        <div>Name</div>
                        <div>Type</div>
                        <div>Value</div>
                      </div>
                      {(selectedFunctionABI as any).inputs.map(
                        (input: any, index: number) => {
                          const name = input?.name || `param${index}`
                          const type = input?.type || ''
                          const value =
                            (reviewData?.argsByName as any)?.[name] ?? ''
                          const valueStr =
                            typeof value === 'string'
                              ? value
                              : JSON.stringify(value)
                          return (
                            <div
                              key={`${name}-${index}`}
                              className="grid grid-cols-3 gap-2 px-4 py-3 text-sm"
                            >
                              <div className="text-text-primary wrap-break-word">
                                {name}
                              </div>
                              <div className="text-text-secondary wrap-break-word">
                                {type}
                              </div>
                              <div className="text-text-primary font-mono wrap-break-word">
                                {valueStr}
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  ) : (
                    <p className="text-text-secondary text-sm">
                      This function has no parameters.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-text-primary text-base font-medium leading-normal">
                    Encoded calldata preview
                  </p>
                  <textarea
                    className="form-input w-full min-h-[120px] resize-y rounded border border-border-color bg-background p-4 text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    aria-label="Encoded calldata preview"
                    readOnly
                    value={reviewData?.calldata || 'Unable to encode calldata preview.'}
                  />
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
                  className={`flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] ${
                    isHighRiskFunction && confirmText !== 'CONFIRM'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-primary/90 transition-colors'
                  }`}
                  disabled={
                    isPending ||
                    !reviewData?.calldata ||
                    !normalizedTimelockController ||
                    !operationParams.delay ||
                    !contractAddress ||
                    !isAddress(contractAddress, { strict: false }) ||
                    typeof minDelay !== 'bigint' ||
                    !hasProposerRole ||
                    (isHighRiskFunction && confirmText !== 'CONFIRM')
                  }
                  onClick={handleSubmitSchedule}
                >
                  <span className="truncate">
                    {isPending ? 'Submitting…' : 'Submit'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* T062: Manual ABI Input Modal */}
      {showManualABIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border-color rounded-lg shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-text-primary text-2xl font-bold">
                Contract Not Verified
              </h2>
              <button
                onClick={() => {
                  setShowManualABIModal(false)
                  setManualABIInput('')
                  setManualABIError(null)
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-text-secondary mb-4">
              This contract is not verified on Blockscout. Please paste the
              contract ABI JSON to continue.
            </p>

            <label className="flex flex-col gap-2 mb-4">
              <span className="text-text-primary font-medium">
                Contract ABI (JSON)
              </span>
              <textarea
                className="form-input w-full min-h-[300px] resize-y rounded border border-border-color bg-background p-4 text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder='[{"type":"function","name":"transfer","inputs":[...],...}]'
                value={manualABIInput}
                onChange={(e) => {
                  setManualABIInput(e.target.value)
                  setManualABIError(null)
                }}
              />
            </label>

            {manualABIError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4 mb-4">
                <p className="text-red-400 text-sm">{manualABIError}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-4">
              <button
                onClick={() => {
                  setShowManualABIModal(false)
                  setManualABIInput('')
                  setManualABIError(null)
                }}
                className="px-6 py-3 rounded-full bg-surface border border-border-color text-text-primary hover:bg-border-color transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleManualABISubmit}
                className="px-6 py-3 rounded-full bg-primary text-black font-bold hover:bg-primary/90 transition-colors"
              >
                Use This ABI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NewProposalView
