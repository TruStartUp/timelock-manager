import React, { useState } from 'react'

const DecoderView: React.FC = () => {
  // State for form inputs
  const [calldata, setCalldata] = useState('')
  const [contractAddress, setContractAddress] = useState('')
  const [abi, setAbi] = useState('')
  const [isDecoded, setIsDecoded] = useState(true) // Set to true to show example output

  // Handler for Decode button
  const handleDecode = () => {
    // TODO: Implement actual decoding logic when data hooks/services are available
    // This will call a service or hook to decode the calldata
    console.log('Decoding calldata:', { calldata, contractAddress, abi })
    setIsDecoded(true)
  }

  // Handler for Clear button
  const handleClear = () => {
    setCalldata('')
    setContractAddress('')
    setAbi('')
    setIsDecoded(false)
  }

  return (
    <>
      {/* PageHeading */}
      <div className="mb-8">
        <h1 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em]">
          Calldata Decoder
        </h1>
        <p className="text-text-secondary text-base font-normal leading-normal mt-2">
          Decode arbitrary calldata or transaction hashes from the Rootstock
          network.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Input Section */}
        <div className="flex flex-col gap-6">
          <h3 className="text-text-primary tracking-light text-2xl font-bold leading-tight">
            Input
          </h3>

          {/* Calldata Input */}
          <div className="flex flex-col">
            <label
              className="text-text-primary text-base font-medium leading-normal pb-2"
              htmlFor="calldata"
            >
              Calldata (0x...)
            </label>
            <textarea
              className="form-input flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded font-mono text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface focus:border-primary/50 min-h-36 placeholder:text-text-secondary p-4 leading-relaxed"
              id="calldata"
              placeholder="Paste raw hexadecimal calldata here..."
              value={calldata}
              onChange={(e) => setCalldata(e.target.value)}
            />
          </div>

          {/* Contract Address Input */}
          <div className="flex flex-col">
            <label
              className="text-text-primary text-base font-medium leading-normal pb-2"
              htmlFor="contract-address"
            >
              Contract Address (Optional)
            </label>
            <input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded font-mono text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface focus:border-primary/50 h-14 placeholder:text-text-secondary p-4"
              id="contract-address"
              placeholder="0x..."
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
            />
          </div>

          {/* ABI Input */}
          <div className="flex flex-col">
            <label
              className="text-text-primary text-base font-medium leading-normal pb-2"
              htmlFor="abi"
            >
              Contract ABI (JSON, Optional)
            </label>
            <textarea
              className="form-input flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded font-mono text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-color bg-surface focus:border-primary/50 min-h-36 placeholder:text-text-secondary p-4 leading-relaxed"
              id="abi"
              placeholder="Paste contract ABI JSON here..."
              value={abi}
              onChange={(e) => setAbi(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-2">
            <button
              className="flex h-12 flex-1 items-center justify-center rounded bg-primary px-6 text-base font-semibold text-white transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
              onClick={handleDecode}
            >
              Decode
            </button>
            <button
              className="flex h-12 items-center justify-center rounded border border-border-color bg-surface px-6 text-base font-semibold text-text-secondary transition-all hover:bg-border-color hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-border-color focus:ring-offset-2 focus:ring-offset-background"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="flex flex-col gap-6">
          <h3 className="text-text-primary tracking-light text-2xl font-bold leading-tight">
            Output
          </h3>
          <div className="flex h-full min-h-[400px] flex-col rounded border border-border-color bg-surface p-6">
            {isDecoded ? (
              /* Decoded State */
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Decoded Function</h4>
                  <span className="inline-flex items-center rounded-full bg-success/20 px-3 py-1 text-sm font-medium text-success">
                    Verified
                  </span>
                </div>

                {/* Function Name Card */}
                <div className="rounded border border-border-color bg-background p-4">
                  <p className="font-mono text-sm text-text-secondary">
                    Function
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <p className="font-mono text-base break-all">
                      <span className="text-yellow-400">transfer</span>(
                      <span className="text-cyan-400">address</span>{' '}
                      <span className="text-purple-400">to</span>,{' '}
                      <span className="text-cyan-400">uint256</span>{' '}
                      <span className="text-purple-400">amount</span>)
                    </p>
                    <button className="text-text-secondary hover:text-text-primary transition-colors">
                      <span className="material-symbols-outlined">
                        content_copy
                      </span>
                    </button>
                  </div>
                </div>

                {/* Signature Card */}
                <div className="rounded border border-border-color bg-background p-4">
                  <p className="font-mono text-sm text-text-secondary">
                    Signature
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <p className="font-mono text-base text-orange-400">
                      0xa9059cbb
                    </p>
                    <button className="text-text-secondary hover:text-text-primary transition-colors">
                      <span className="material-symbols-outlined">
                        content_copy
                      </span>
                    </button>
                  </div>
                </div>

                {/* Parameters */}
                <div className="mt-2">
                  <h4 className="text-lg font-semibold">Parameters</h4>
                  <div className="mt-4 flex flex-col gap-3">
                    {/* Parameter 1 */}
                    <div className="grid grid-cols-[1fr_2fr] items-start gap-4 rounded border border-border-color bg-background p-4">
                      <div className="flex flex-col">
                        <p className="font-mono text-sm text-text-secondary">
                          Parameter
                        </p>
                        <p className="font-mono text-base text-purple-400 mt-1">
                          to
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <p className="font-mono text-sm text-text-secondary">
                          Value (<span className="text-cyan-400">address</span>)
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="font-mono text-base text-orange-400 break-all">
                            0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
                          </p>
                          <button className="text-text-secondary hover:text-text-primary transition-colors self-start">
                            <span className="material-symbols-outlined">
                              content_copy
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Parameter 2 */}
                    <div className="grid grid-cols-[1fr_2fr] items-start gap-4 rounded border border-border-color bg-background p-4">
                      <div className="flex flex-col">
                        <p className="font-mono text-sm text-text-secondary">
                          Parameter
                        </p>
                        <p className="font-mono text-base text-purple-400 mt-1">
                          amount
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <p className="font-mono text-sm text-text-secondary">
                          Value (<span className="text-cyan-400">uint256</span>)
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="font-mono text-base text-orange-400 break-all">
                            1000000000000000000
                          </p>
                          <button className="text-text-secondary hover:text-text-primary transition-colors self-start">
                            <span className="material-symbols-outlined">
                              content_copy
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Initial/Empty State */
              <div className="flex flex-1 items-center justify-center text-center">
                <p className="text-text-secondary">
                  Awaiting input to decode...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default DecoderView
