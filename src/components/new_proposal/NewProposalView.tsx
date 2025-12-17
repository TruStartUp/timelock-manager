import React, { useMemo, useState, useEffect } from 'react'
import {
  encodeAbiParameters,
  isAddress,
  type Address,
  encodeFunctionData,
  keccak256,
  toBytes,
} from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { useContractABI } from '@/hooks/useContractABI'
import { useTimelockWrite } from '@/hooks/useTimelockWrite'
import { normalizeAddressLoose } from '@/lib/validation'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { formatTxError } from '@/lib/txErrors'
import { VALIDATION } from '@/lib/constants'

type SimulationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'error'; message: string }

interface BatchOperation {
  id: string                    // Unique ID for React keys
  contractAddress: string
  value: string                 // RBTC value to send (in wei as string)
  fetchedABI: {
    abi: unknown[]
    source: string
    confidence: string
    isProxy: boolean
    implementationAddress?: Address
  } | null
  selectedFunction: string
  formData: Record<string, unknown>
  calldata: `0x${string}` | null
}

const NewProposalView: React.FC = () => {
  // State for wizard steps
  const [currentStep, setCurrentStep] = useState(1)
  const [contractAddress, setContractAddress] = useState('')
  const [addressToFetch, setAddressToFetch] = useState<Address | undefined>()
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false)
  // Step 1: used to ensure we only auto-advance/open modals in response to an explicit Fetch ABI click,
  // not due to navigation (e.g., Step 2 -> Back -> Step 1).
  const [step1FetchNonce, setStep1FetchNonce] = useState(0)
  const lastHandledStep1FetchNonceRef = React.useRef(0)
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
  // T113: focus management for manual ABI dialog
  const manualDialogCloseRef = React.useRef<HTMLButtonElement | null>(null)
  const lastFocusedElRef = React.useRef<HTMLElement | null>(null)

  const closeManualABIModal = () => {
    // Mark the current fetch as handled so the modal doesn't immediately reopen.
    lastHandledStep1FetchNonceRef.current = step1FetchNonce
    setShowManualABIModal(false)
    setManualABIInput('')
    setManualABIError(null)
  }

  // Batch operations state
  const [operations, setOperations] = useState<BatchOperation[]>([])
  // ABI cache for reuse (maps contract address → ABI data)
  const [abiCache, setAbiCache] = useState<Map<string, BatchOperation['fetchedABI']>>(new Map())

  // T065: Step 3 review state
  const [operationParams, setOperationParams] = useState({
    delay: '', // in seconds
    timelockController: '', // contract that schedules the operation
    predecessor: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    salt: '' as `0x${string}`, // will generate random
  })
  // T066: High-risk confirmation gate
  const [confirmText, setConfirmText] = useState('')
  // T111: schedule() simulation preview in Step 3
  const publicClient = usePublicClient()
  const [scheduleSimulation, setScheduleSimulation] =
    useState<SimulationState>({ status: 'idle' })

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
    isCheckingRole,
    reset: resetSchedule,
  } = useTimelockWrite({
    timelockController: timelockAddress,
    account: connectedAddress,
  })

  // T111: simulate schedule() when we are on Step 3 and have enough data to preview.
  useEffect(() => {
    const run = async () => {
      // Check if all operations have calldata
      const allOperationsValid = operations.every(op => !!op.calldata)

      const hasBasics =
        currentStep === 3 &&
        !!publicClient &&
        !!normalizedTimelockController &&
        !!connectedAddress &&
        allOperationsValid &&
        operations.length > 0 &&
        !!operationParams.delay &&
        !!operationParams.salt

      if (!hasBasics) {
        setScheduleSimulation({ status: 'idle' })
        return
      }

      let delay: bigint
      try {
        delay = BigInt(operationParams.delay)
      } catch {
        setScheduleSimulation({
          status: 'error',
          message: 'Delay must be a valid integer (in seconds).',
        })
        return
      }

      setScheduleSimulation({ status: 'pending' })
      try {
        // Prepare parameters
        const targets = operations.map(op =>
          op.contractAddress.trim().replace(/^0X/, '0x').toLowerCase() as Address
        )
        const values = operations.map(op => {
          try {
            return BigInt(op.value || '0')
          } catch {
            return BigInt(0)
          }
        })
        const payloads = operations.map(op => op.calldata!)

        // Simulate either schedule() or scheduleBatch()
        if (operations.length === 1) {
          await publicClient!.simulateContract({
            address: timelockAddress,
            abi: TimelockControllerABI as any,
            functionName: 'schedule',
            args: [
              targets[0],
              values[0],
              payloads[0],
              operationParams.predecessor,
              operationParams.salt,
              delay,
            ],
            account: connectedAddress,
          } as any)
        } else {
          await publicClient!.simulateContract({
            address: timelockAddress,
            abi: TimelockControllerABI as any,
            functionName: 'scheduleBatch',
            args: [
              targets,
              values,
              payloads,
              operationParams.predecessor,
              operationParams.salt,
              delay,
            ],
            account: connectedAddress,
          } as any)
        }

        setScheduleSimulation({ status: 'success' })
      } catch (err) {
        setScheduleSimulation({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    run()
  }, [
    connectedAddress,
    currentStep,
    normalizedTimelockController,
    operationParams.delay,
    operationParams.predecessor,
    operationParams.salt,
    publicClient,
    operations,
    timelockAddress,
  ])

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<
    | {
        // Single operation
        target: Address
        value: bigint
        data: `0x${string}`
        predecessor: `0x${string}`
        salt: `0x${string}`
        delay: bigint
        submittedAtMs: number
      }
    | {
        // Batch operations
        targets: Address[]
        values: bigint[]
        payloads: `0x${string}`[]
        predecessor: `0x${string}`
        salt: `0x${string}`
        delay: bigint
        submittedAtMs: number
      }
    | null
  >(null)

  // Trigger refetch when addressToFetch changes (user clicked Fetch ABI)
  useEffect(() => {
    if (addressToFetch && hasAttemptedFetch) {
      refetchABI()
    }
  }, [addressToFetch, hasAttemptedFetch, refetchABI])

  // T113: focus trap-lite for manual ABI modal
  useEffect(() => {
    if (showManualABIModal) {
      lastFocusedElRef.current = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => manualDialogCloseRef.current?.focus())
      return
    }
    lastFocusedElRef.current?.focus?.()
  }, [showManualABIModal])

  // T061: Store successful ABI fetch for use in later steps
  useEffect(() => {
    if (abi && abi.length > 0 && !isAbiLoading && !isAbiError) {
      const abiData = {
        abi,
        source: source || 'unknown',
        confidence: confidence || 'low',
        isProxy: isProxy || false,
        implementationAddress,
      }

      setFetchedABIData(abiData)

      // Initialize operations[0] with the first operation
      const shouldHandleStep1Fetch =
        currentStep === 1 &&
        hasAttemptedFetch &&
        !!addressToFetch &&
        step1FetchNonce > lastHandledStep1FetchNonceRef.current

      if (shouldHandleStep1Fetch && addressToFetch) {
        const normalizedAddress = addressToFetch.toLowerCase()

        // Store ABI in cache
        setAbiCache(prev => new Map(prev).set(normalizedAddress, abiData))

        // Initialize first operation
        setOperations([{
          id: `op-${Date.now()}-0`,
          contractAddress: addressToFetch,
          value: '0',
          fetchedABI: abiData,
          selectedFunction: '',
          formData: {},
          calldata: null,
        }])

        // UX: after an explicit Fetch ABI succeeds, automatically advance to Step 2.
        lastHandledStep1FetchNonceRef.current = step1FetchNonce
        setCurrentStep(2)
      }
    } else if (
      !isAbiLoading &&
      hasAttemptedFetch &&
      addressToFetch &&
      (!abi || abi.length === 0)
    ) {
      const shouldHandleStep1Fetch =
        currentStep === 1 &&
        step1FetchNonce > lastHandledStep1FetchNonceRef.current

      if (shouldHandleStep1Fetch) {
        // T062: Unverified contract - show manual ABI modal (Step 1 only, once per Fetch click)
        lastHandledStep1FetchNonceRef.current = step1FetchNonce
        setShowManualABIModal(true)
      }
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
    step1FetchNonce,
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
  const isHighRiskFunction = useMemo(() => {
    // Check if any operation uses a high-risk function
    return operations.some(op => {
      if (!op.selectedFunction) return false
      const functionName = op.selectedFunction.split('(')[0].toLowerCase()
      return (
        functionName === 'upgradeto' ||
        functionName === 'transferownership' ||
        functionName === 'setadmin' ||
        functionName === 'updatedelay'
      )
    })
  }, [operations])

  // Helper to generate appropriate placeholder based on Solidity type
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
    setStep1FetchNonce(n => n + 1)
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

  // Operation management functions
  const handleAddOperation = () => {
    if (operations.length >= VALIDATION.MAX_BATCH_CALLS) {
      alert(`Maximum batch size is ${VALIDATION.MAX_BATCH_CALLS} operations`)
      return
    }

    const newOp: BatchOperation = {
      id: `op-${Date.now()}-${Math.random()}`,
      contractAddress: '',
      value: '0',
      fetchedABI: null,
      selectedFunction: '',
      formData: {},
      calldata: null,
    }

    setOperations([...operations, newOp])
  }

  const handleRemoveOperation = (index: number) => {
    if (operations.length <= 1) return
    setOperations(operations.filter((_, i) => i !== index))
  }

  const handleUpdateOperation = (index: number, updates: Partial<BatchOperation>) => {
    const updated = [...operations]
    updated[index] = { ...updated[index], ...updates }
    setOperations(updated)
  }

  const handleFetchAbiForOperation = (index: number, address: string) => {
    if (!isAddress(address, { strict: false })) {
      return
    }

    const normalizedAddress = address.trim().replace(/^0X/, '0x').toLowerCase()

    // Check cache first
    const cachedABI = abiCache.get(normalizedAddress)
    if (cachedABI) {
      handleUpdateOperation(index, {
        fetchedABI: cachedABI,
        contractAddress: address,
      })
      return
    }

    // Set addressToFetch to trigger the useContractABI hook
    // The hook will fetch the ABI and we'll store it in the cache
    setAddressToFetch(normalizedAddress as Address)
    setHasAttemptedFetch(true)

    // Store the index so we know which operation to update when ABI arrives
    // We'll handle this in a useEffect
  }

  const handleSubmitSchedule = () => {
    setSubmitError(null)

    if (!hasProposerRole) {
      setSubmitError('Your wallet does not have the PROPOSER_ROLE.')
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

    // Validate batch size
    if (operations.length === 0 || operations.length > VALIDATION.MAX_BATCH_CALLS) {
      setSubmitError(`Invalid batch size. Must have 1-${VALIDATION.MAX_BATCH_CALLS} operations.`)
      return
    }

    // Validate all operations have calldata
    const invalidOps = operations.filter(op => !op.calldata)
    if (invalidOps.length > 0) {
      setSubmitError(`${invalidOps.length} operation(s) incomplete. Please ensure all operations are configured.`)
      return
    }

    // Validate all operation addresses
    const invalidAddresses = operations.filter(
      op => !op.contractAddress || !isAddress(op.contractAddress, { strict: false })
    )
    if (invalidAddresses.length > 0) {
      setSubmitError('One or more operations have invalid contract addresses.')
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

    // Build operation parameters
    const targets = operations.map(op =>
      op.contractAddress.trim().replace(/^0X/, '0x').toLowerCase() as Address
    )
    const values = operations.map(op => {
      try {
        return BigInt(op.value || '0')
      } catch {
        setSubmitError(`Invalid RBTC value in one or more operations: ${op.value}`)
        throw new Error('Invalid value')
      }
    })
    const payloads = operations.map(op => op.calldata!)
    const predecessor = operationParams.predecessor
    const salt = operationParams.salt

    setHasSubmitted(true)

    // Auto-detect single vs batch
    if (operations.length === 1) {
      // Single operation
      setLastSubmitted({
        target: targets[0],
        value: values[0],
        data: payloads[0],
        predecessor,
        salt,
        delay,
        submittedAtMs: Date.now(),
      })

      schedule({
        target: targets[0],
        value: values[0],
        data: payloads[0],
        predecessor,
        salt,
        delay,
      })
    } else {
      // Batch operation
      setLastSubmitted({
        targets,
        values,
        payloads,
        predecessor,
        salt,
        delay,
        submittedAtMs: Date.now(),
      })

      schedule({
        targets,
        values,
        payloads,
        predecessor,
        salt,
        delay,
      })
    }
  }

  // Handler for Next button
  const handleNext = () => {
    if (currentStep === 2) {
      // Moving from Step 2 to Step 3 - encode calldata for all operations

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

      // Encode calldata for each operation
      const updatedOperations = operations.map((operation) => {
        // Skip if already encoded or no function selected
        if (operation.calldata || !operation.selectedFunction || !operation.fetchedABI) {
          return operation
        }

        // Find the selected function ABI
        const selectedFunctionABI = operation.fetchedABI.abi.find((item: any) => {
          if (item?.type !== 'function') return false
          const match = operation.selectedFunction.match(/^([^(]+)\((.*)\)$/)
          if (!match) return false
          const functionName = match[1]
          const typeList = match[2] ?? ''
          const normalizedTypeList = typeList
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .join(',')
          const itemTypeList = (item?.inputs ?? [])
            .map((input: any) => input?.type)
            .filter(Boolean)
            .join(',')
          const mutability = item?.stateMutability
          const isWrite = mutability !== 'view' && mutability !== 'pure'
          return isWrite && item?.name === functionName && itemTypeList === normalizedTypeList
        })

        if (!selectedFunctionABI) {
          console.warn(`Could not find ABI for function: ${operation.selectedFunction}`)
          return operation
        }

        const fnName = (selectedFunctionABI as any)?.name as string | undefined
        const inputs = ((selectedFunctionABI as any)?.inputs ?? []) as any[]

        // Convert form data to args in order
        const argsInOrder: unknown[] = inputs.map((input: any, index: number) => {
          const inputName = input?.name || `param${index}`
          const inputType = input?.type as string | undefined
          const raw = (operation.formData as any)?.[inputName]
          if (typeof raw !== 'string' || !inputType) return raw

          // Minimal coercion for encoding:
          // - uint/int -> bigint
          // - bool -> boolean
          // - address -> normalized
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
          if (inputType === 'address') {
            return normalizeAddressLoose(raw)
          }
          return raw
        })

        // Encode calldata
        let calldata: `0x${string}` | null = null
        try {
          if (fnName) {
            calldata = encodeFunctionData({
              abi: [selectedFunctionABI as any],
              functionName: fnName,
              args: argsInOrder as any,
            }) as `0x${string}`
          }
        } catch (err) {
          console.warn(`Failed to encode calldata for operation ${operation.id}:`, err)
        }

        return {
          ...operation,
          calldata,
        }
      })

      setOperations(updatedOperations)
      setCurrentStep(3)
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
      const abiData = {
        abi: parsedABI,
        source: 'manual',
        confidence: 'high',
        isProxy: false,
      }

      setFetchedABIData(abiData)

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

        // Store ABI in our cache
        const normalizedAddress = addressToFetch.toLowerCase()
        setAbiCache(prev => new Map(prev).set(normalizedAddress, abiData))

        // Initialize first operation
        setOperations([{
          id: `op-${Date.now()}-0`,
          contractAddress: addressToFetch,
          value: '0',
          fetchedABI: abiData,
          selectedFunction: '',
          formData: {},
          calldata: null,
        }])

        // Advance to Step 2
        lastHandledStep1FetchNonceRef.current = step1FetchNonce
        setCurrentStep(2)
      }

      // Close modal and clear input
      closeManualABIModal()
    } catch (err) {
      setManualABIError(
        err instanceof Error ? err.message : 'Invalid JSON format'
      )
    }
  }

  const friendlyScheduleError = useMemo(() => {
    if (!scheduleError) return null
    return formatTxError(scheduleError)
  }, [scheduleError])

  const operationId = useMemo(() => {
    if (!lastSubmitted) return null
    try {
      // Check if batch or single operation
      if ('targets' in lastSubmitted && Array.isArray(lastSubmitted.targets)) {
        // Batch: hashOperationBatch(targets[], values[], payloads[], predecessor, salt)
        // id = keccak256(abi.encode(targets, values, keccak256(payloads)[], predecessor, salt))
        const payloadHashes = lastSubmitted.payloads.map(p => keccak256(p))
        const encoded = encodeAbiParameters(
          [
            { name: 'targets', type: 'address[]' },
            { name: 'values', type: 'uint256[]' },
            { name: 'payloadHashes', type: 'bytes32[]' },
            { name: 'predecessor', type: 'bytes32' },
            { name: 'salt', type: 'bytes32' },
          ],
          [
            lastSubmitted.targets,
            lastSubmitted.values,
            payloadHashes,
            lastSubmitted.predecessor,
            lastSubmitted.salt,
          ]
        )
        return keccak256(encoded)
      } else {
        // Single: hashOperation(target, value, data, predecessor, salt)
        // id = keccak256(abi.encode(target, value, keccak256(data), predecessor, salt))
        const single = lastSubmitted as {
          target: Address
          value: bigint
          data: `0x${string}`
          predecessor: `0x${string}`
          salt: `0x${string}`
          delay: bigint
          submittedAtMs: number
        }
        const dataHash = keccak256(single.data)
        const encoded = encodeAbiParameters(
          [
            { name: 'target', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'dataHash', type: 'bytes32' },
            { name: 'predecessor', type: 'bytes32' },
            { name: 'salt', type: 'bytes32' },
          ],
          [
            single.target,
            single.value,
            dataHash,
            single.predecessor,
            single.salt,
          ]
        )
        return keccak256(encoded)
      }
    } catch {
      return null
    }
  }, [lastSubmitted])

  const estimatedEta = useMemo(() => {
    if (!lastSubmitted) return null
    try {
      const delayMs = Number(lastSubmitted.delay) * 1000
      const eta = new Date(lastSubmitted.submittedAtMs + delayMs)
      return eta.toLocaleString()
    } catch {
      return null
    }
  }, [lastSubmitted])

  const showSuccess = Boolean(hasSubmitted && isSuccess && txHash)

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

          {/* Step 2: Configure Operations */}
          {currentStep === 2 && (
            <div className="mt-16 flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
                  Step 2: Configure Operations
                </p>
                <p className="text-text-secondary text-base font-normal leading-normal">
                  Configure each operation in the batch. Add multiple operations to execute them atomically.
                </p>
              </div>

              {operations.length === 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
                  <p className="text-yellow-400 text-base">
                    No operations configured. Please go back to Step 1 and fetch a contract ABI.
                  </p>
                </div>
              ) : (
                <>
                  {/* Operations List */}
                  <div className="flex flex-col gap-6">
                    {operations.map((operation, opIndex) => {
                      // Get available functions for this operation
                      const opAvailableFunctions = operation.fetchedABI
                        ? operation.fetchedABI.abi
                            .filter((item: any) => {
                              if (item?.type !== 'function') return false
                              const mutability = item?.stateMutability
                              return mutability !== 'view' && mutability !== 'pure'
                            })
                            .map((func: any) => {
                              const params = func.inputs?.map((input: any) => input.type).join(',') || ''
                              const signature = `${func.name}(${params})`
                              return { name: func.name, signature, inputs: func.inputs || [] }
                            })
                            .sort((a, b) => a.name.localeCompare(b.name))
                        : []

                      // Get selected function ABI
                      const opSelectedFunctionABI = operation.fetchedABI && operation.selectedFunction
                        ? operation.fetchedABI.abi.find((item: any) => {
                            if (item?.type !== 'function') return false
                            const match = operation.selectedFunction.match(/^([^(]+)\((.*)\)$/)
                            if (!match) return false
                            const functionName = match[1]
                            const typeList = match[2] ?? ''
                            const normalizedTypeList = typeList
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .join(',')
                            const itemTypeList = (item?.inputs ?? [])
                              .map((input: any) => input?.type)
                              .filter(Boolean)
                              .join(',')
                            const mutability = item?.stateMutability
                            const isWrite = mutability !== 'view' && mutability !== 'pure'
                            return isWrite && item?.name === functionName && itemTypeList === normalizedTypeList
                          })
                        : null

                      return (
                        <div
                          key={operation.id}
                          className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6"
                        >
                          {/* Operation Header */}
                          <div className="flex items-center justify-between">
                            <h3 className="text-text-primary text-lg font-bold">
                              Operation {opIndex + 1} of {operations.length}
                            </h3>
                            <div className="flex items-center gap-3">
                              {/* Validation Badge - TODO: Add validation logic */}
                              {operation.calldata ? (
                                <span className="text-green-500 text-sm">✓</span>
                              ) : (
                                <span className="text-yellow-500 text-sm">⚠</span>
                              )}

                              {/* Remove Button */}
                              {operations.length > 1 && (
                                <button
                                  onClick={() => handleRemoveOperation(opIndex)}
                                  className="text-text-secondary hover:text-red-500 transition-colors"
                                  aria-label={`Remove operation ${opIndex + 1}`}
                                >
                                  <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Target Contract Address */}
                          <label className="flex flex-col w-full">
                            <p className="text-text-primary text-base font-medium leading-normal pb-2">
                              Target Contract Address
                            </p>
                            <div className="flex gap-3">
                              <input
                                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                                placeholder="0x..."
                                type="text"
                                value={operation.contractAddress}
                                onChange={(e) =>
                                  handleUpdateOperation(opIndex, { contractAddress: e.target.value })
                                }
                              />
                              <button
                                className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 px-6 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50"
                                onClick={() => handleFetchAbiForOperation(opIndex, operation.contractAddress)}
                                disabled={!isAddress(operation.contractAddress, { strict: false })}
                              >
                                <span className="truncate">Fetch ABI</span>
                              </button>
                            </div>

                            {/* ABI Status */}
                            {operation.fetchedABI && (
                              <div className="flex items-center gap-2 text-sm text-green-500 mt-2">
                                <span className="material-symbols-outlined text-base">task_alt</span>
                                <p>
                                  ABI loaded ({opAvailableFunctions.length} functions) • {operation.fetchedABI.source} • {operation.fetchedABI.confidence}
                                  {abiCache.get(operation.contractAddress.toLowerCase()) && operation.fetchedABI.source !== 'manual' && (
                                    <> • <span className="text-text-secondary">Using cached ABI</span></>
                                  )}
                                </p>
                              </div>
                            )}
                          </label>

                          {/* Value (RBTC in wei) */}
                          <label className="flex flex-col w-full">
                            <p className="text-text-primary text-base font-medium leading-normal pb-2">
                              Value (RBTC in wei)
                            </p>
                            <input
                              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal font-mono"
                              placeholder="0"
                              type="text"
                              value={operation.value}
                              onChange={(e) =>
                                handleUpdateOperation(opIndex, { value: e.target.value })
                              }
                            />
                            <p className="text-text-secondary text-xs mt-2">
                              Amount of RBTC to send with this operation (in wei). Use 0 for no transfer.
                            </p>
                          </label>

                          {/* Function Selector */}
                          {operation.fetchedABI && (
                            <>
                              <div className="flex flex-col w-full">
                                <p className="text-text-primary text-base font-medium leading-normal pb-2">
                                  Select Function
                                </p>
                                <div className="relative w-full">
                                  <select
                                    className="form-select w-full appearance-none rounded border border-border-color bg-background h-14 py-[15px] pl-[15px] pr-12 text-text-primary text-base font-normal leading-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={operation.selectedFunction}
                                    onChange={(e) =>
                                      handleUpdateOperation(opIndex, {
                                        selectedFunction: e.target.value,
                                        formData: {}, // Reset form data when function changes
                                      })
                                    }
                                    disabled={opAvailableFunctions.length === 0}
                                  >
                                    {opAvailableFunctions.length === 0 ? (
                                      <option>No functions available</option>
                                    ) : (
                                      <>
                                        <option value="">Select a function...</option>
                                        {opAvailableFunctions.map((func) => (
                                          <option key={func.signature} value={func.signature}>
                                            {func.signature}
                                          </option>
                                        ))}
                                      </>
                                    )}
                                  </select>
                                  <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
                                    unfold_more
                                  </span>
                                </div>
                              </div>

                              {/* Parameter Inputs */}
                              {opSelectedFunctionABI && (opSelectedFunctionABI as any).inputs && (opSelectedFunctionABI as any).inputs.length > 0 ? (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                  {(opSelectedFunctionABI as any).inputs.map((input: any, inputIndex: number) => {
                                    const inputName = input.name || `param${inputIndex}`
                                    const inputType = input.type
                                    const inputValue = (operation.formData as any)?.[inputName] ?? ''

                                    return (
                                      <label key={`${operation.id}-${inputName}-${inputIndex}`} className="flex flex-col w-full">
                                        <p className="text-text-primary text-base font-medium leading-normal pb-2">
                                          {inputName} ({inputType})
                                        </p>
                                        {inputType === 'bool' ? (
                                          <div className="relative w-full">
                                            <select
                                              value={inputValue === true ? 'true' : inputValue === false ? 'false' : ''}
                                              onChange={(e) => {
                                                const newFormData = { ...operation.formData }
                                                ;(newFormData as any)[inputName] = e.target.value === 'true'
                                                handleUpdateOperation(opIndex, { formData: newFormData })
                                              }}
                                              className="form-select w-full appearance-none rounded border border-border-color bg-background h-14 py-[15px] pl-[15px] pr-12 text-text-primary text-base font-normal leading-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                              <option value="">Select...</option>
                                              <option value="true">True</option>
                                              <option value="false">False</option>
                                            </select>
                                            <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary">
                                              unfold_more
                                            </span>
                                          </div>
                                        ) : (
                                          <input
                                            value={inputValue}
                                            onChange={(e) => {
                                              const newFormData = { ...operation.formData }
                                              ;(newFormData as any)[inputName] = e.target.value
                                              handleUpdateOperation(opIndex, { formData: newFormData })
                                            }}
                                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-background h-14 placeholder:text-text-secondary p-[15px] text-base font-normal leading-normal"
                                            placeholder={getPlaceholderForType(inputType)}
                                            type="text"
                                          />
                                        )}
                                      </label>
                                    )
                                  })}
                                </div>
                              ) : operation.selectedFunction ? (
                                <div className="bg-background rounded p-6 text-center">
                                  <p className="text-text-secondary">
                                    This function has no parameters
                                  </p>
                                </div>
                              ) : null}
                            </>
                          )}

                          {/* Divider (except for last operation) */}
                          {opIndex < operations.length - 1 && (
                            <div className="border-t border-border-color -mx-6 my-2" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Add Operation Button + Total Count */}
                  <div className="flex items-center justify-between rounded-lg border border-border-color bg-surface p-4">
                    <button
                      onClick={handleAddOperation}
                      disabled={operations.length >= VALIDATION.MAX_BATCH_CALLS}
                      className="flex items-center gap-2 cursor-pointer rounded-full px-6 py-3 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                      <span className="truncate">Add Operation</span>
                    </button>
                    <p className="text-text-secondary text-sm">
                      Total: {operations.length} operation{operations.length !== 1 ? 's' : ''}
                      {operations.length >= VALIDATION.MAX_BATCH_CALLS && (
                        <span className="text-yellow-500 ml-2">(Maximum reached)</span>
                      )}
                    </p>
                  </div>

                  {/* Navigation Buttons */}
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
                  Step 3: Review {operations.length > 1 ? 'Batch' : 'Operation'}
                </p>
                <p className="text-text-secondary text-base font-normal leading-normal">
                  Review {operations.length > 1 ? `all ${operations.length} operations` : 'the operation details'} before scheduling.
                </p>
              </div>

              {showSuccess ? (
                <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
                  <div className="flex items-center gap-3 text-green-500">
                    <span className="material-symbols-outlined text-base">
                      task_alt
                    </span>
                    <p className="text-base font-medium">
                      {operations.length > 1 ? 'Batch operation' : 'Operation'} scheduled successfully
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <p className="text-text-primary text-sm font-medium">
                        TX Hash
                      </p>
                      <p
                        className="text-text-primary font-mono text-sm wrap-break-word"
                        aria-label="Transaction hash"
                      >
                        {txHash}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-text-primary text-sm font-medium">
                        Estimated ETA
                      </p>
                      <p
                        className="text-text-primary text-sm"
                        aria-label="Estimated ETA"
                      >
                        {estimatedEta || '—'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                      <p className="text-text-primary text-sm font-medium">
                        Operation ID
                      </p>
                      <p
                        className="text-text-primary font-mono text-sm wrap-break-word"
                        aria-label="Operation ID"
                      >
                        {operationId || '—'}
                      </p>
                      <p className="text-text-secondary text-xs">
                        Computed locally using TimelockController hash{operations.length > 1 ? 'OperationBatch' : 'Operation'} algorithm.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-start gap-4">
                    <button
                      className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-surface text-text-primary text-sm font-medium leading-normal tracking-[0.015em] border border-border-color hover:bg-border-color transition-colors"
                      onClick={() => {
                        // Reset wizard for another proposal
                        setHasSubmitted(false)
                        setLastSubmitted(null)
                        setSubmitError(null)
                        setConfirmText('')
                        resetSchedule()
                        setCurrentStep(1)
                      }}
                    >
                      <span className="truncate">Schedule another</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                <div className="flex flex-col gap-6 rounded-lg border border-border-color bg-surface p-6">
                  {/* Batch Summary */}
                  {operations.length > 1 && (
                    <div className="flex flex-col gap-4 pb-6 border-b border-border-color">
                      <p className="text-text-primary text-lg font-bold">
                        Batch Summary
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <p className="text-text-secondary text-xs uppercase tracking-wide">
                            Total Operations
                          </p>
                          <p className="text-text-primary text-2xl font-bold">
                            {operations.length}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-text-secondary text-xs uppercase tracking-wide">
                            Total RBTC Value
                          </p>
                          <p className="text-text-primary text-2xl font-bold">
                            {(() => {
                              try {
                                const totalWei = operations.reduce((sum, op) => {
                                  try {
                                    return sum + BigInt(op.value || '0')
                                  } catch {
                                    return sum
                                  }
                                }, BigInt(0))
                                const rbtc = Number(totalWei) / 1e18
                                return `${rbtc.toFixed(4)} RBTC`
                              } catch {
                                return '0 RBTC'
                              }
                            })()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-text-secondary text-xs uppercase tracking-wide">
                            Unique Targets
                          </p>
                          <p className="text-text-primary text-2xl font-bold">
                            {new Set(operations.map(op => op.contractAddress.toLowerCase())).size}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Operations List */}
                  <div className="flex flex-col gap-4">
                    <p className="text-text-primary text-lg font-bold">
                      {operations.length > 1 ? 'Operations Details' : 'Operation Details'}
                    </p>

                    {operations.map((operation, opIndex) => {
                      // Get selected function ABI for this operation
                      const opSelectedFunctionABI = operation.fetchedABI && operation.selectedFunction
                        ? operation.fetchedABI.abi.find((item: any) => {
                            if (item?.type !== 'function') return false
                            const match = operation.selectedFunction.match(/^([^(]+)\((.*)\)$/)
                            if (!match) return false
                            const functionName = match[1]
                            const typeList = match[2] ?? ''
                            const normalizedTypeList = typeList
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .join(',')
                            const itemTypeList = (item?.inputs ?? [])
                              .map((input: any) => input?.type)
                              .filter(Boolean)
                              .join(',')
                            const mutability = item?.stateMutability
                            const isWrite = mutability !== 'view' && mutability !== 'pure'
                            return isWrite && item?.name === functionName && itemTypeList === normalizedTypeList
                          })
                        : null

                      return (
                        <div
                          key={operation.id}
                          className="flex flex-col gap-4 rounded border border-border-color bg-background p-6"
                        >
                          {/* Operation Header */}
                          <div className="flex items-center justify-between border-b border-border-color pb-3">
                            <h3 className="text-text-primary text-base font-bold">
                              Operation {opIndex + 1}{operations.length > 1 ? ` of ${operations.length}` : ''}
                            </h3>
                            {operation.calldata ? (
                              <span className="text-green-500 text-sm flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">task_alt</span>
                                Valid
                              </span>
                            ) : (
                              <span className="text-yellow-500 text-sm flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">warning</span>
                                Incomplete
                              </span>
                            )}
                          </div>

                          {/* Target Contract */}
                          <div className="flex flex-col gap-2">
                            <p className="text-text-secondary text-xs uppercase tracking-wide">
                              Target Contract
                            </p>
                            <p className="text-text-primary font-mono text-sm wrap-break-word">
                              {operation.contractAddress || '0x…'}
                            </p>
                          </div>

                          {/* Value (RBTC) */}
                          <div className="flex flex-col gap-2">
                            <p className="text-text-secondary text-xs uppercase tracking-wide">
                              Value (RBTC)
                            </p>
                            <p className="text-text-primary text-sm">
                              {(() => {
                                try {
                                  const wei = BigInt(operation.value || '0')
                                  const rbtc = Number(wei) / 1e18
                                  return `${rbtc.toFixed(4)} RBTC (${wei.toString()} wei)`
                                } catch {
                                  return '0 RBTC (0 wei)'
                                }
                              })()}
                            </p>
                          </div>

                          {/* Function Signature */}
                          <div className="flex flex-col gap-2">
                            <p className="text-text-secondary text-xs uppercase tracking-wide">
                              Function
                            </p>
                            <p className="text-text-primary font-mono text-sm wrap-break-word">
                              {operation.selectedFunction || '—'}
                            </p>
                          </div>

                          {/* Parameters */}
                          {opSelectedFunctionABI && (opSelectedFunctionABI as any).inputs && (opSelectedFunctionABI as any).inputs.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-text-secondary text-xs uppercase tracking-wide">
                                Parameters
                              </p>
                              <div className="rounded border border-border-color">
                                <div className="grid grid-cols-3 gap-2 border-b border-border-color px-4 py-3 text-xs text-text-secondary bg-surface">
                                  <div>Name</div>
                                  <div>Type</div>
                                  <div>Value</div>
                                </div>
                                {(opSelectedFunctionABI as any).inputs.map((input: any, inputIndex: number) => {
                                  const inputName = input.name || `param${inputIndex}`
                                  const inputType = input.type
                                  const inputValue = (operation.formData as any)?.[inputName] ?? ''
                                  const valueStr = typeof inputValue === 'string' ? inputValue : JSON.stringify(inputValue)

                                  return (
                                    <div
                                      key={`${operation.id}-${inputName}-${inputIndex}`}
                                      className="grid grid-cols-3 gap-2 px-4 py-3 text-sm border-b border-border-color last:border-b-0"
                                    >
                                      <div className="text-text-primary wrap-break-word">
                                        {inputName}
                                      </div>
                                      <div className="text-text-secondary wrap-break-word">
                                        {inputType}
                                      </div>
                                      <div className="text-text-primary font-mono wrap-break-word">
                                        {valueStr}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ) : operation.selectedFunction ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-text-secondary text-xs uppercase tracking-wide">
                                Parameters
                              </p>
                              <p className="text-text-secondary text-sm italic">
                                No parameters
                              </p>
                            </div>
                          ) : null}

                          {/* Calldata */}
                          <div className="flex flex-col gap-2">
                            <p className="text-text-secondary text-xs uppercase tracking-wide">
                              Encoded Calldata
                            </p>
                            <textarea
                              className="form-input w-full min-h-[80px] resize-y rounded border border-border-color bg-surface p-3 text-text-primary font-mono text-xs focus:outline-none"
                              aria-label={`Calldata for operation ${opIndex + 1}`}
                              readOnly
                              value={operation.calldata || 'Unable to encode calldata'}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* High-risk confirmation gate */}
                  {isHighRiskFunction && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <p className="text-yellow-400 text-sm font-medium">
                        High-risk function detected
                      </p>
                      <p className="text-text-secondary text-sm mt-1">
                        One or more functions are commonly used for upgrades/admin changes.
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

                  {/* Permission feedback: schedule requires PROPOSER_ROLE */}
                  {normalizedTimelockController && (
                    <>
                      {isCheckingRole ? (
                        <div className="bg-background border border-border-color rounded-lg p-4">
                          <p className="text-text-secondary text-sm">
                            Checking if your wallet has <code>PROPOSER_ROLE</code>…
                          </p>
                        </div>
                      ) : !hasProposerRole ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <p className="text-red-400 text-sm font-medium">
                            Not authorized to schedule
                          </p>
                          <p className="text-text-secondary text-sm mt-1">
                            The connected wallet does not have{' '}
                            <code>PROPOSER_ROLE</code> on this TimelockController, so
                            it cannot schedule operations.
                          </p>
                        </div>
                      ) : null}
                    </>
                  )}

                  {/* Timelock Settings */}
                  <div className="flex flex-col gap-4 pt-6 border-t border-border-color">
                    <p className="text-text-primary text-lg font-bold">
                      Timelock Settings
                    </p>

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
                          calls <code>schedule{operations.length > 1 ? 'Batch' : ''}()</code>.
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
                </div>

                <div className="flex items-center justify-start gap-4">
                  <button
                    className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-surface text-text-primary text-sm font-medium leading-normal tracking-[0.015em] border border-border-color hover:bg-border-color transition-colors"
                    onClick={handleBack}
                  >
                    <span className="truncate">Back</span>
                  </button>
                    {/* T111: schedule simulation preview */}
                    <div
                      className="flex-1 rounded border border-border-color bg-background p-3 text-sm max-h-40 overflow-y-auto"
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-text-primary">
                          Simulation
                        </span>
                        {scheduleSimulation.status === 'pending' ? (
                          <span className="text-text-secondary">Running…</span>
                        ) : scheduleSimulation.status === 'success' ? (
                          <span className="text-green-500">Likely succeeds</span>
                        ) : scheduleSimulation.status === 'error' ? (
                          <span className="text-red-400">May fail</span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </div>
                      {scheduleSimulation.status === 'error' ? (
                        <p className="mt-2 text-red-400 text-xs wrap-break-word overflow-wrap-anywhere">
                          {scheduleSimulation.message}
                        </p>
                      ) : null}
                    </div>
                  <button
                    className={`flex min-w-[84px] items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-black text-sm font-bold leading-normal tracking-[0.015em] ${
                      isPending ||
                        scheduleSimulation.status === 'pending' ||
                      operations.some(op => !op.calldata) ||
                      !normalizedTimelockController ||
                      !operationParams.delay ||
                      typeof minDelay !== 'bigint' ||
                      !hasProposerRole ||
                      (isHighRiskFunction && confirmText !== 'CONFIRM')
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-primary/90 transition-colors'
                    }`}
                    disabled={
                      isPending ||
                      scheduleSimulation.status === 'pending' ||
                      operations.some(op => !op.calldata) ||
                      !normalizedTimelockController ||
                      !operationParams.delay ||
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
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* T062: Manual ABI Input Modal */}
      {showManualABIModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-abi-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeManualABIModal()
            }
          }}
        >
          <div className="bg-surface border border-border-color rounded-lg shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2
                id="manual-abi-title"
                className="text-text-primary text-2xl font-bold"
              >
                Contract Not Verified
              </h2>
              <button
                onClick={() => {
                  closeManualABIModal()
                }}
                className="text-text-secondary hover:text-text-primary"
                aria-label="Close manual ABI dialog"
                ref={manualDialogCloseRef}
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
                  closeManualABIModal()
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
