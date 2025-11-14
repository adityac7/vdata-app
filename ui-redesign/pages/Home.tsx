import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, Play, ArrowLeft, Sparkles, Info, Users, ShoppingBag, MapPin, DollarSign, Calendar, User } from "lucide-react";
import { APP_LOGO } from "@/const";

interface QueryStatus {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
}

export default function Home() {
  const [screen, setScreen] = useState<'config' | 'execution' | 'results'>('config');
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedAges, setSelectedAges] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedNCCS, setSelectedNCCS] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [analysisQuery, setAnalysisQuery] = useState<string>("");
  const [queries, setQueries] = useState<QueryStatus[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const databases = [
    { value: "hul", label: "HUL Combined Data" },
    { value: "hul_prod", label: "HUL Production" },
    { value: "hul_analytics", label: "HUL Analytics" },
  ];

  const categoryOptions: MultiSelectOption[] = [
    { value: "personal_care", label: "Personal Care" },
    { value: "home_care", label: "Home Care" },
    { value: "foods", label: "Foods & Refreshment" },
    { value: "beauty", label: "Beauty & Personal Care" },
    { value: "hygiene", label: "Hygiene" },
  ];

  // Brand options filtered by selected categories
  const allBrands: Record<string, MultiSelectOption[]> = {
    personal_care: [
      { value: "dove", label: "Dove" },
      { value: "lifebuoy", label: "Lifebuoy" },
      { value: "lux", label: "Lux" },
      { value: "ponds", label: "Pond's" },
      { value: "vaseline", label: "Vaseline" },
    ],
    home_care: [
      { value: "surf_excel", label: "Surf Excel" },
      { value: "rin", label: "Rin" },
      { value: "vim", label: "Vim" },
      { value: "domex", label: "Domex" },
    ],
    foods: [
      { value: "knorr", label: "Knorr" },
      { value: "kissan", label: "Kissan" },
      { value: "bru", label: "Bru" },
    ],
    beauty: [
      { value: "fair_lovely", label: "Fair & Lovely" },
      { value: "lakmé", label: "Lakmé" },
    ],
    hygiene: [
      { value: "lifebuoy", label: "Lifebuoy" },
      { value: "dettol", label: "Dettol" },
    ],
  };

  // Filter brands based on selected categories
  const brandOptions: MultiSelectOption[] = selectedCategories.length > 0
    ? selectedCategories.flatMap(cat => allBrands[cat] || [])
        .filter((brand, index, self) => 
          index === self.findIndex((b) => b.value === brand.value)
        )
    : Object.values(allBrands).flat()
        .filter((brand, index, self) => 
          index === self.findIndex((b) => b.value === brand.value)
        );

  // Reset brands when categories change
  useEffect(() => {
    if (selectedCategories.length > 0) {
      const validBrands = brandOptions.map(b => b.value);
      setSelectedBrands(prev => prev.filter(b => validBrands.includes(b)));
    }
  }, [selectedCategories]);

  const ageOptions: MultiSelectOption[] = [
    { value: "18-24", label: "18-24 (Gen Z)" },
    { value: "25-34", label: "25-34 (Young Millennials)" },
    { value: "35-44", label: "35-44 (Older Millennials)" },
    { value: "45-54", label: "45-54 (Gen X)" },
    { value: "55+", label: "55+ (Boomers)" },
  ];

  const genderOptions: MultiSelectOption[] = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

  const stateOptions: MultiSelectOption[] = [
    { value: "maharashtra", label: "Maharashtra" },
    { value: "karnataka", label: "Karnataka" },
    { value: "tamil_nadu", label: "Tamil Nadu" },
    { value: "delhi", label: "Delhi" },
    { value: "uttar_pradesh", label: "Uttar Pradesh" },
    { value: "west_bengal", label: "West Bengal" },
    { value: "gujarat", label: "Gujarat" },
    { value: "rajasthan", label: "Rajasthan" },
    { value: "punjab", label: "Punjab" },
  ];

  const nccsOptions: MultiSelectOption[] = [
    { value: "a1", label: "A1 (Upper)" },
    { value: "a2", label: "A2" },
    { value: "b1", label: "B1" },
    { value: "b2", label: "B2" },
    { value: "c1", label: "C1" },
    { value: "c2", label: "C2" },
    { value: "d", label: "D" },
    { value: "e", label: "E (Lower)" },
  ];

  const zoneOptions: MultiSelectOption[] = [
    { value: "north", label: "North" },
    { value: "south", label: "South" },
    { value: "east", label: "East" },
    { value: "west", label: "West" },
    { value: "central", label: "Central" },
  ];

  const handleAnalyze = () => {
    if (!selectedDatabase) {
      return;
    }

    setIsAnalyzing(true);
    setScreen('execution');

    // Simulate ChatGPT generating queries based on TG selection
    setTimeout(() => {
      const mockQueries: QueryStatus[] = [
        { id: "1", description: "Analyzing demographic distribution across selected target segments", status: 'pending', progress: 0 },
        { id: "2", description: "Calculating weighted purchase frequency and basket trends", status: 'pending', progress: 0 },
        { id: "3", description: "Identifying top product preferences by age and gender", status: 'pending', progress: 0 },
        { id: "4", description: "Evaluating brand loyalty metrics with weighted data", status: 'pending', progress: 0 },
        { id: "5", description: "Comparing seasonal consumption patterns across zones", status: 'pending', progress: 0 },
      ];

      setQueries(mockQueries);
      setIsAnalyzing(false);

      // Execute queries sequentially
      mockQueries.forEach((query, index) => {
        setTimeout(() => {
          setQueries(prev => prev.map(q => 
            q.id === query.id ? { ...q, status: 'running' as const, progress: 10 } : q
          ));

          const progressInterval = setInterval(() => {
            setQueries(prev => prev.map(q => {
              if (q.id === query.id && q.progress < 95) {
                return { ...q, progress: q.progress + Math.random() * 15 };
              }
              return q;
            }));
          }, 300);

          setTimeout(() => {
            clearInterval(progressInterval);
            setQueries(prev => prev.map(q => 
              q.id === query.id ? { ...q, status: 'completed' as const, progress: 100 } : q
            ));

            // After all queries complete, show results screen
            if (index === mockQueries.length - 1) {
              setTimeout(() => {
                setScreen('results');
              }, 1000);
            }
          }, 2000 + Math.random() * 2000);
        }, index * 500);
      });
    }, 1500);
  };

  const handleBack = () => {
    setScreen('config');
    setQueries([]);
    setIsAnalyzing(false);
  };

  const handleNewAnalysis = () => {
    setScreen('config');
    setQueries([]);
    setIsAnalyzing(false);
  };

  // Results Screen
  if (screen === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={APP_LOGO} alt="VTION" className="h-10" />
                <div className="h-6 w-px bg-gray-300" />
                <div>
                  <h1 className="text-xl font-semibold" style={{ color: '#0c0e2d' }}>Analysis Complete</h1>
                  <p className="text-sm text-gray-500">ChatGPT is analyzing results...</p>
                </div>
              </div>
              <Button
                onClick={handleNewAnalysis}
                className="bg-gradient-to-r from-[#00afaf] to-[#dd33cc] hover:opacity-90 text-white"
              >
                New Analysis
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-8 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#00afaf] to-[#dd33cc] mx-auto mb-6 flex items-center justify-center animate-pulse">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#0c0e2d' }}>
              All Queries Executed Successfully
            </h2>
            <p className="text-gray-600 mb-6">
              ChatGPT is now analyzing the weighted data results and generating insights for your target group...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00afaf' }} />
              <span>Processing results...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Execution Screen
  if (screen === 'execution') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <img src={APP_LOGO} alt="VTION" className="h-8" />
                <div>
                  <h1 className="text-xl font-semibold" style={{ color: '#0c0e2d' }}>Query Execution</h1>
                  <p className="text-sm text-gray-500">Running weighted data analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#00afaf]/10 to-[#dd33cc]/10 border border-[#00afaf]/20">
                <div className="w-2 h-2 rounded-full bg-[#00afaf] animate-pulse" />
                <span className="text-xs font-medium text-gray-700">Processing</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-8 py-12">
          {/* Target Group Persona Card */}
          <div className="mb-8 p-8 bg-gradient-to-br from-white via-[#00afaf]/5 to-[#dd33cc]/5 rounded-2xl border border-gray-200 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#00afaf] to-[#dd33cc] flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold" style={{ color: '#0c0e2d' }}>Target Group Profile</h3>
                <p className="text-sm text-gray-500">Your selected audience persona</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Demographics */}
              {(selectedAges.length > 0 || selectedGenders.length > 0) && (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#00afaf]/10 flex items-center justify-center">
                      <User className="w-4 h-4" style={{ color: '#00afaf' }} />
                    </div>
                    <h4 className="font-semibold text-sm" style={{ color: '#0c0e2d' }}>Demographics</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedAges.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-500">Age Groups</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAges.slice(0, 3).map(age => (
                            <span key={age} className="text-xs px-2 py-1 rounded-full bg-[#00afaf]/10 font-medium" style={{ color: '#00afaf' }}>
                              {ageOptions.find(a => a.value === age)?.label.split(' ')[0]}
                            </span>
                          ))}
                          {selectedAges.length > 3 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                              +{selectedAges.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedGenders.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-500">Gender</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedGenders.map(gender => (
                            <span key={gender} className="text-xs px-2 py-1 rounded-full bg-[#dd33cc]/10 font-medium" style={{ color: '#dd33cc' }}>
                              {genderOptions.find(g => g.value === gender)?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Geographic */}
              {(selectedStates.length > 0 || selectedZones.length > 0) && (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#dd33cc]/10 flex items-center justify-center">
                      <MapPin className="w-4 h-4" style={{ color: '#dd33cc' }} />
                    </div>
                    <h4 className="font-semibold text-sm" style={{ color: '#0c0e2d' }}>Geographic</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedZones.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1">Zones</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedZones.map(zone => (
                            <span key={zone} className="text-xs px-2 py-1 rounded-full bg-[#dd33cc]/10 font-medium" style={{ color: '#dd33cc' }}>
                              {zoneOptions.find(z => z.value === zone)?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedStates.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1">States</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedStates.slice(0, 3).map(state => (
                            <span key={state} className="text-xs px-2 py-1 rounded-full bg-[#00afaf]/10 font-medium" style={{ color: '#00afaf' }}>
                              {stateOptions.find(s => s.value === state)?.label}
                            </span>
                          ))}
                          {selectedStates.length > 3 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                              +{selectedStates.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Socioeconomic & Interests */}
              {(selectedNCCS.length > 0 || selectedCategories.length > 0 || selectedBrands.length > 0) && (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#0c0e2d]/10 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" style={{ color: '#0c0e2d' }} />
                    </div>
                    <h4 className="font-semibold text-sm" style={{ color: '#0c0e2d' }}>Interests & Class</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedNCCS.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-500">NCCS</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNCCS.slice(0, 4).map(nccs => (
                            <span key={nccs} className="text-xs px-2 py-1 rounded-full bg-[#0c0e2d]/10 font-medium" style={{ color: '#0c0e2d' }}>
                              {nccsOptions.find(n => n.value === nccs)?.label.split(' ')[0]}
                            </span>
                          ))}
                          {selectedNCCS.length > 4 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                              +{selectedNCCS.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedCategories.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1">Categories</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCategories.slice(0, 2).map(cat => (
                            <span key={cat} className="text-xs px-2 py-1 rounded-full bg-[#00afaf]/10 font-medium" style={{ color: '#00afaf' }}>
                              {categoryOptions.find(c => c.value === cat)?.label}
                            </span>
                          ))}
                          {selectedCategories.length > 2 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                              +{selectedCategories.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedBrands.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1">Brands</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedBrands.slice(0, 3).map(brand => (
                            <span key={brand} className="text-xs px-2 py-1 rounded-full bg-[#dd33cc]/10 font-medium" style={{ color: '#dd33cc' }}>
                              {brandOptions.find(b => b.value === brand)?.label}
                            </span>
                          ))}
                          {selectedBrands.length > 3 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                              +{selectedBrands.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Database Badge */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Data Source:</span>
                  <span className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-[#00afaf] to-[#dd33cc] text-white font-semibold">
                    {databases.find(db => db.value === selectedDatabase)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-[#00afaf] animate-pulse" />
                  <span className="font-medium">Weighted Data Analysis</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="mb-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#0c0e2d' }}>Analysis Progress</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {queries.filter(q => q.status === 'completed').length} of {queries.length} queries completed
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold bg-gradient-to-r from-[#00afaf] to-[#dd33cc] bg-clip-text text-transparent">
                  {Math.round((queries.filter(q => q.status === 'completed').length / queries.length) * 100)}%
                </div>
                <p className="text-xs text-gray-500 mt-1">Complete</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00afaf] to-[#dd33cc] transition-all duration-500 ease-out"
                style={{ width: `${(queries.filter(q => q.status === 'completed').length / queries.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Query Stack */}
          <div className="space-y-4">
            {queries.map((query, index) => (
              <div
                key={query.id}
                className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'slideInUp 0.5s ease-out forwards',
                  opacity: 0
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {query.status === 'pending' && (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      </div>
                    )}
                    {query.status === 'running' && (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00afaf]/10 to-[#dd33cc]/10 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#00afaf' }} />
                      </div>
                    )}
                    {query.status === 'completed' && (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00afaf] to-[#dd33cc] flex items-center justify-center animate-scaleIn">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {query.status === 'error' && (
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-sm font-medium leading-relaxed" style={{ color: '#0c0e2d' }}>
                        {query.description}
                      </p>
                      <span className="text-xs font-semibold text-gray-400 font-mono whitespace-nowrap">
                        #{query.id}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#00afaf] to-[#dd33cc] transition-all duration-500 ease-out rounded-full"
                          style={{ width: `${query.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          {query.status === 'pending' && 'Queued'}
                          {query.status === 'running' && 'Running analysis...'}
                          {query.status === 'completed' && 'Analysis completed'}
                          {query.status === 'error' && 'Failed'}
                        </span>
                        <span className="text-xs font-bold text-gray-400 font-mono">
                          {Math.round(query.progress)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        <style>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes scaleIn {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }
          .animate-scaleIn {
            animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        `}</style>
      </div>
    );
  }

  // Configuration Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={APP_LOGO} alt="VTION Genie" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#0c0e2d' }}>VTION Genie</h1>
                <p className="text-sm text-gray-500">AI-Powered Consumer Insights</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ color: '#0c0e2d' }}>
            Select your TG for analysis
          </h2>
          <p className="text-gray-600">Define your target group and let ChatGPT generate insights from weighted data</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {/* Weighted Data Notice */}
          <div className="mb-6 p-4 bg-gradient-to-r from-[#00afaf]/5 to-[#dd33cc]/5 border border-[#00afaf]/20 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#00afaf' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#0c0e2d' }}>Weighted Data Analysis</p>
              <p className="text-xs text-gray-600 mt-1">All queries will be executed on weighted data for accurate population-level insights</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Database Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: '#0c0e2d' }}>
                Database <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                <SelectTrigger className="h-11 bg-gray-50 border-gray-300 hover:border-[#00afaf] transition-colors">
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db.value} value={db.value}>
                      {db.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filters Section */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold" style={{ color: '#0c0e2d' }}>Target Group Filters</h3>
                <span className="text-xs text-gray-500">(Optional - Multi-select with search)</span>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {/* Category - First */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <MultiSelect
                    options={categoryOptions}
                    selected={selectedCategories}
                    onChange={setSelectedCategories}
                    placeholder="Select categories..."
                  />
                </div>

                {/* Brand - Filtered by Category */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Brand {selectedCategories.length > 0 && <span className="text-xs text-gray-500">(filtered)</span>}
                  </label>
                  <MultiSelect
                    options={brandOptions}
                    selected={selectedBrands}
                    onChange={setSelectedBrands}
                    placeholder="Select brands..."
                  />
                </div>

                {/* Age Group */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Age Group</label>
                  <MultiSelect
                    options={ageOptions}
                    selected={selectedAges}
                    onChange={setSelectedAges}
                    placeholder="Select age groups..."
                  />
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Gender</label>
                  <MultiSelect
                    options={genderOptions}
                    selected={selectedGenders}
                    onChange={setSelectedGenders}
                    placeholder="Select genders..."
                  />
                </div>

                {/* State */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">State</label>
                  <MultiSelect
                    options={stateOptions}
                    selected={selectedStates}
                    onChange={setSelectedStates}
                    placeholder="Select states..."
                  />
                </div>

                {/* Zone */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Zone</label>
                  <MultiSelect
                    options={zoneOptions}
                    selected={selectedZones}
                    onChange={setSelectedZones}
                    placeholder="Select zones..."
                  />
                </div>

                {/* NCCS */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">NCCS (Socioeconomic Classification)</label>
                  <MultiSelect
                    options={nccsOptions}
                    selected={selectedNCCS}
                    onChange={setSelectedNCCS}
                    placeholder="Select NCCS groups..."
                  />
                </div>
              </div>
            </div>

            {/* Additional Context (Optional) */}
            <div className="space-y-2 pt-4">
              <label className="text-sm font-semibold" style={{ color: '#0c0e2d' }}>
                Additional Context <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              </label>
              <Textarea
                placeholder="E.g., Focus on seasonal trends, compare with last year, analyze purchase drivers..."
                value={analysisQuery}
                onChange={(e) => setAnalysisQuery(e.target.value)}
                className="min-h-[100px] bg-gray-50 border-gray-300 focus:border-[#00afaf] resize-none"
              />
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!selectedDatabase || isAnalyzing}
              className="w-full h-14 bg-gradient-to-r from-[#00afaf] to-[#dd33cc] hover:opacity-90 text-white font-semibold text-base shadow-lg shadow-[#00afaf]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending to ChatGPT...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Analyze with ChatGPT
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
