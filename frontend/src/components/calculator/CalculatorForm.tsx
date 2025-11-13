import React, { useState, useCallback } from 'react';
import { ProductConfigInput } from '../../types/ProductConfig';

/**
 * Calculator Form Component
 * 
 * Provides a comprehensive form for collecting product configuration input
 * to be used for pricing calculation. Handles validation and user experience
 * for all product configuration fields.
 */

// Local form state interface with optional fields for progressive disclosure
interface FormState {
  // Required fields
  size: {
    widthM: string;
    depthM: string;
  };
  
  // Optional configuration sections
  cladding: {
    areaSqm?: string;
  } | undefined;
  
  bathroom: {
    half?: string;
    three_quarter?: string;
  } | undefined;
  
  electrical: {
    switches?: string;
    sockets?: string;
    heater?: string;
    underskink_heater?: string;
    elec_boiler?: string;
  } | undefined;
  
  internal_doors: string | undefined;
  
  internal_wall: {
    finish?: 'none' | 'panel' | 'skim_paint';
    areaSqM?: string;
  } | undefined;
  
  heaters: string | undefined;
  
  glazing: {
    windows?: Array<{ widthM: string; heightM: string; id: string }> | undefined;
    externalDoors?: Array<{ widthM: string; heightM: string; id: string }> | undefined;
    skylights?: Array<{ widthM: string; heightM: string; id: string }> | undefined;
  } | undefined;
  
  floor: {
    type?: 'none' | 'wooden' | 'tile';
    areaSqM?: string;
  } | undefined;
  
  delivery: {
    distanceKm?: string;
    cost?: string;
  } | undefined;
  
  extras: {
    esp_insulation?: string;
    render?: string;
    steel_door?: string;
    concrete_foundation?: string;
    other?: Array<{ title: string; cost: string; id: string }>;
  } | undefined;
  
  discount: string | undefined;
  notes: string | undefined;
  permittedDevelopmentFlags: Array<{ code: string; label: string; id: string }> | undefined;
}

interface CalculatorFormProps {
  onCalculate: (productConfig: ProductConfigInput) => void;
  isLoading?: boolean;
  errors?: Record<string, string>;
  defaultValues?: Partial<ProductConfigInput>;
}

interface ValidationErrors {
  [key: string]: string | ValidationErrors;
}

export const CalculatorForm: React.FC<CalculatorFormProps> = ({
  onCalculate,
  isLoading = false,
  errors: externalErrors = {},
  defaultValues
}) => {
  // Initialize form state with defaults
  const [formState, setFormState] = useState<FormState>(() => ({
    size: {
      widthM: defaultValues?.size?.widthM?.toString() || '',
      depthM: defaultValues?.size?.depthM?.toString() || ''
    },
    cladding: defaultValues?.cladding ? {
      areaSqm: defaultValues.cladding.areaSqm?.toString() || ''
    } : undefined,
    bathroom: defaultValues?.bathroom ? {
      half: defaultValues.bathroom.half?.toString() || '',
      three_quarter: defaultValues.bathroom.three_quarter?.toString() || ''
    } : undefined,
    electrical: defaultValues?.electrical ? {
      switches: defaultValues.electrical.switches?.toString() || '',
      sockets: defaultValues.electrical.sockets?.toString() || '',
      heater: defaultValues.electrical.heater?.toString() || '',
      underskink_heater: defaultValues.electrical.underskink_heater?.toString() || '',
      elec_boiler: defaultValues.electrical.elec_boiler?.toString() || ''
    } : undefined,
    internal_doors: defaultValues?.internal_doors?.toString() || '',
    internal_wall: defaultValues?.internal_wall ? {
      finish: defaultValues.internal_wall.finish || 'none',
      areaSqM: defaultValues.internal_wall.areaSqM?.toString() || ''
    } : { finish: 'none' },
    heaters: defaultValues?.heaters?.toString() || '',
    glazing: defaultValues?.glazing ? {
      windows: defaultValues.glazing.windows?.map((item, index) => ({
        widthM: item.widthM.toString(),
        heightM: item.heightM.toString(),
        id: `window-${index}`
      })),
      externalDoors: defaultValues.glazing.externalDoors?.map((item, index) => ({
        widthM: item.widthM.toString(),
        heightM: item.heightM.toString(),
        id: `door-${index}`
      })),
      skylights: defaultValues.glazing.skylights?.map((item, index) => ({
        widthM: item.widthM.toString(),
        heightM: item.heightM.toString(),
        id: `skylight-${index}`
      }))
    } : undefined,
    floor: defaultValues?.floor ? {
      type: defaultValues.floor.type || 'none',
      areaSqM: defaultValues.floor.areaSqM?.toString() || ''
    } : { type: 'none' },
    delivery: defaultValues?.delivery ? {
      distanceKm: defaultValues.delivery.distanceKm?.toString() || '',
      cost: defaultValues.delivery.cost?.toString() || ''
    } : undefined,
    extras: defaultValues?.extras ? {
      esp_insulation: defaultValues.extras.esp_insulation?.toString() || '',
      render: defaultValues.extras.render?.toString() || '',
      steel_door: defaultValues.extras.steel_door?.toString() || '',
      concrete_foundation: defaultValues.extras.concrete_foundation?.toString() || '',
      other: defaultValues.extras.other?.map((item, index) => ({
        title: item.title,
        cost: item.cost.toString(),
        id: `extra-${index}`
      })) || []
    } : undefined,
    discount: defaultValues?.discount?.toString() || '',
    notes: defaultValues?.notes || '',
    permittedDevelopmentFlags: defaultValues?.permittedDevelopmentFlags?.map((flag, index) => ({
      ...flag,
      id: `flag-${index}`
    })) || []
  }));

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Generic field update handler
  const updateField = useCallback((path: string[], value: string | boolean) => {
    setFormState(prev => {
      const newState = { ...prev };
      let current = newState as Record<string, unknown>;
      
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (key && !current[key]) {
          current[key] = {};
        }
        if (key) {
          current = current[key] as Record<string, unknown>;
        }
      }
      
      const lastKey = path[path.length - 1];
      if (lastKey) {
        current[lastKey] = value;
      }
      return newState;
    });
    
    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      let current = newErrors as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (key && current[key]) {
          current = current[key] as Record<string, unknown>;
        } else {
          return newErrors;
        }
      }
      const lastKey = path[path.length - 1];
      if (lastKey) {
        delete current[lastKey];
      }
      return newErrors;
    });
  }, []);

  // Array management handlers
  const addGlazingItem = useCallback((type: 'windows' | 'externalDoors' | 'skylights') => {
    setFormState(prev => ({
      ...prev,
      glazing: {
        ...prev.glazing,
        [type]: [
          ...(prev.glazing?.[type] || []),
          { widthM: '', heightM: '', id: `${type}-${Date.now()}` }
        ]
      }
    }));
  }, []);

  const removeGlazingItem = useCallback((type: 'windows' | 'externalDoors' | 'skylights', id: string) => {
    setFormState(prev => ({
      ...prev,
      glazing: {
        ...prev.glazing,
        [type]: prev.glazing?.[type]?.filter(item => item.id !== id) || []
      }
    }));
  }, []);

  const updateGlazingItem = useCallback((
    type: 'windows' | 'externalDoors' | 'skylights',
    id: string,
    field: 'widthM' | 'heightM',
    value: string
  ) => {
    setFormState(prev => ({
      ...prev,
      glazing: {
        ...prev.glazing,
        [type]: prev.glazing?.[type]?.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        ) || []
      }
    }));
  }, []);

  const addExtraItem = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      extras: {
        ...prev.extras,
        other: [
          ...(prev.extras?.other || []),
          { title: '', cost: '', id: `extra-${Date.now()}` }
        ]
      }
    }));
  }, []);

  const removeExtraItem = useCallback((id: string) => {
    setFormState(prev => ({
      ...prev,
      extras: {
        ...prev.extras,
        other: prev.extras?.other?.filter(item => item.id !== id) || []
      }
    }));
  }, []);

  const updateExtraItem = useCallback((id: string, field: 'title' | 'cost', value: string) => {
    setFormState(prev => ({
      ...prev,
      extras: {
        ...prev.extras,
        other: prev.extras?.other?.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        ) || []
      }
    }));
  }, []);

  const addPermittedDevelopmentFlag = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      permittedDevelopmentFlags: [
        ...(prev.permittedDevelopmentFlags || []),
        { code: '', label: '', id: `flag-${Date.now()}` }
      ]
    }));
  }, []);

  const removePermittedDevelopmentFlag = useCallback((id: string) => {
    setFormState(prev => ({
      ...prev,
      permittedDevelopmentFlags: prev.permittedDevelopmentFlags?.filter(flag => flag.id !== id) || []
    }));
  }, []);

  const updatePermittedDevelopmentFlag = useCallback((id: string, field: 'code' | 'label', value: string) => {
    setFormState(prev => ({
      ...prev,
      permittedDevelopmentFlags: prev.permittedDevelopmentFlags?.map(flag =>
        flag.id === id ? { ...flag, [field]: value } : flag
      ) || []
    }));
  }, []);

  // Convert form state to ProductConfigInput
  const convertToProductConfig = useCallback((): ProductConfigInput | null => {
    try {
      const config: any = {
        size: {
          widthM: parseFloat(formState.size.widthM),
          depthM: parseFloat(formState.size.depthM)
        }
      };

      // Only include optional fields if they have values
      if (formState.cladding?.areaSqm) {
        config.cladding = { areaSqm: parseFloat(formState.cladding.areaSqm) };
      }

      if (formState.bathroom && (formState.bathroom.half || formState.bathroom.three_quarter)) {
        config.bathroom = {};
        if (formState.bathroom.half) config.bathroom.half = parseInt(formState.bathroom.half, 10);
        if (formState.bathroom.three_quarter) config.bathroom.three_quarter = parseInt(formState.bathroom.three_quarter, 10);
      }

      if (formState.electrical && Object.values(formState.electrical).some(v => v)) {
        config.electrical = {};
        Object.entries(formState.electrical).forEach(([key, value]) => {
          if (value) config.electrical[key] = parseInt(value as string, 10);
        });
      }

      if (formState.internal_doors) {
        config.internal_doors = parseInt(formState.internal_doors, 10);
      }

      if (formState.internal_wall && formState.internal_wall.finish !== 'none') {
        config.internal_wall = {
          finish: formState.internal_wall.finish,
          areaSqM: formState.internal_wall.areaSqM ? parseFloat(formState.internal_wall.areaSqM) : undefined
        };
      }

      if (formState.heaters) {
        config.heaters = parseInt(formState.heaters, 10);
      }

      if (formState.glazing) {
        const glazingConfig: { 
          windows?: Array<{ widthM: number; heightM: number }>;
          externalDoors?: Array<{ widthM: number; heightM: number }>;
          skylights?: Array<{ widthM: number; heightM: number }>;
        } = {};
        
        if (formState.glazing.windows?.length) {
          const windows = formState.glazing.windows
            .filter(w => w.widthM && w.heightM)
            .map(w => ({ widthM: parseFloat(w.widthM), heightM: parseFloat(w.heightM) }));
          if (windows.length > 0) glazingConfig.windows = windows;
        }
        if (formState.glazing.externalDoors?.length) {
          const doors = formState.glazing.externalDoors
            .filter(d => d.widthM && d.heightM)
            .map(d => ({ widthM: parseFloat(d.widthM), heightM: parseFloat(d.heightM) }));
          if (doors.length > 0) glazingConfig.externalDoors = doors;
        }
        if (formState.glazing.skylights?.length) {
          const skylights = formState.glazing.skylights
            .filter(s => s.widthM && s.heightM)
            .map(s => ({ widthM: parseFloat(s.widthM), heightM: parseFloat(s.heightM) }));
          if (skylights.length > 0) glazingConfig.skylights = skylights;
        }
        
        // Only add glazing if it has content
        if (Object.keys(glazingConfig).length > 0) {
          config.glazing = glazingConfig;
        }
      }

      if (formState.floor && formState.floor.type !== 'none') {
        config.floor = {
          type: formState.floor.type,
          areaSqM: formState.floor.areaSqM ? parseFloat(formState.floor.areaSqM) : undefined
        };
      }

      if (formState.delivery && (formState.delivery.distanceKm || formState.delivery.cost)) {
        config.delivery = {};
        if (formState.delivery.distanceKm) config.delivery.distanceKm = parseFloat(formState.delivery.distanceKm);
        if (formState.delivery.cost) config.delivery.cost = parseFloat(formState.delivery.cost);
      }

      if (formState.extras) {
        const extrasConfig: Record<string, unknown> = {};
        Object.entries(formState.extras).forEach(([key, value]) => {
          if (key === 'other' && Array.isArray(value)) {
            const validOtherItems = value.filter(item => item.title && item.cost);
            if (validOtherItems.length) {
              extrasConfig.other = validOtherItems.map(item => ({
                title: item.title,
                cost: parseFloat(item.cost)
              }));
            }
          } else if (value) {
            extrasConfig[key] = parseFloat(value as string);
          }
        });
        
        // Only add extras if it has content
        if (Object.keys(extrasConfig).length > 0) {
          config.extras = extrasConfig;
        }
      }

      if (formState.discount) {
        config.discount = parseFloat(formState.discount);
      }

      if (formState.notes) {
        config.notes = formState.notes;
      }

      if (formState.permittedDevelopmentFlags?.length) {
        const validFlags = formState.permittedDevelopmentFlags.filter(flag => flag.code && flag.label);
        if (validFlags.length) {
          config.permittedDevelopmentFlags = validFlags.map(flag => ({
            code: flag.code,
            label: flag.label
          }));
        }
      }

      return config as ProductConfigInput;
    } catch (error) {
      return null;
    }
  }, [formState]);

  // Form submission handler
  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    
    const config = convertToProductConfig();
    if (!config) {
      setValidationErrors({ form: 'Please check your input values' });
      return;
    }

    setValidationErrors({});
    onCalculate(config);
  }, [convertToProductConfig, onCalculate]);

  const renderGlazingSection = (
    type: 'windows' | 'externalDoors' | 'skylights',
    title: string
  ) => {
    const items = formState.glazing?.[type] || [];
    
    return (
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label fw-bold">{title}</label>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => addGlazingItem(type)}
            disabled={isLoading}
          >
            + Add {title.slice(0, -1)}
          </button>
        </div>
        
        {items.map((item) => (
          <div key={item.id} className="row g-2 mb-2 p-2 border rounded">
            <div className="col-md-5">
              <input
                type="number"
                className="form-control form-control-sm"
                placeholder="Width (m)"
                value={item.widthM}
                onChange={(e) => updateGlazingItem(type, item.id, 'widthM', e.target.value)}
                step="0.1"
                min="0"
                disabled={isLoading}
              />
            </div>
            <div className="col-md-5">
              <input
                type="number"
                className="form-control form-control-sm"
                placeholder="Height (m)"
                value={item.heightM}
                onChange={(e) => updateGlazingItem(type, item.id, 'heightM', e.target.value)}
                step="0.1"
                min="0"
                disabled={isLoading}
              />
            </div>
            <div className="col-md-2">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm w-100"
                onClick={() => removeGlazingItem(type, item.id)}
                disabled={isLoading}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="calculator-form">
      <form onSubmit={handleSubmit} className="needs-validation" noValidate>
        {/* Basic Size Configuration */}
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Basic Dimensions</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="widthM" className="form-label">
                  Width (metres) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="widthM"
                  value={formState.size.widthM}
                  onChange={(e) => updateField(['size', 'widthM'], e.target.value)}
                  step="0.1"
                  min="0.1"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="depthM" className="form-label">
                  Depth (metres) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="depthM"
                  value={formState.size.depthM}
                  onChange={(e) => updateField(['size', 'depthM'], e.target.value)}
                  step="0.1"
                  min="0.1"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Basic Options */}
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Basic Options</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="internal_doors" className="form-label">
                  Internal Doors (count)
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="internal_doors"
                  value={formState.internal_doors || ''}
                  onChange={(e) => updateField(['internal_doors'], e.target.value)}
                  min="0"
                  step="1"
                  disabled={isLoading}
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="heaters" className="form-label">
                  Additional Heaters (count)
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="heaters"
                  value={formState.heaters || ''}
                  onChange={(e) => updateField(['heaters'], e.target.value)}
                  min="0"
                  step="1"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className="d-flex justify-content-center mb-4">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            disabled={isLoading}
          >
            {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvancedOptions && (
          <>
            {/* Cladding */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Cladding</h5>
              </div>
              <div className="card-body">
                <div className="col-md-6">
                  <label htmlFor="cladding_area" className="form-label">
                    Cladding Area (sqm)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="cladding_area"
                    value={formState.cladding?.areaSqm || ''}
                    onChange={(e) => updateField(['cladding', 'areaSqm'], e.target.value)}
                    step="0.1"
                    min="0"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* Bathroom */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Bathroom Configuration</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="bathroom_half" className="form-label">
                      Half Bathrooms (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="bathroom_half"
                      value={formState.bathroom?.half || ''}
                      onChange={(e) => updateField(['bathroom', 'half'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="bathroom_three_quarter" className="form-label">
                      Three-Quarter Bathrooms (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="bathroom_three_quarter"
                      value={formState.bathroom?.three_quarter || ''}
                      onChange={(e) => updateField(['bathroom', 'three_quarter'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Electrical */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Electrical Components</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="electrical_switches" className="form-label">
                      Switches (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="electrical_switches"
                      value={formState.electrical?.switches || ''}
                      onChange={(e) => updateField(['electrical', 'switches'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="electrical_sockets" className="form-label">
                      Sockets (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="electrical_sockets"
                      value={formState.electrical?.sockets || ''}
                      onChange={(e) => updateField(['electrical', 'sockets'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="electrical_heater" className="form-label">
                      Electrical Heaters (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="electrical_heater"
                      value={formState.electrical?.heater || ''}
                      onChange={(e) => updateField(['electrical', 'heater'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="electrical_underskink_heater" className="form-label">
                      Under-sink Heaters (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="electrical_underskink_heater"
                      value={formState.electrical?.underskink_heater || ''}
                      onChange={(e) => updateField(['electrical', 'underskink_heater'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="electrical_elec_boiler" className="form-label">
                      Electric Boilers (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="electrical_elec_boiler"
                      value={formState.electrical?.elec_boiler || ''}
                      onChange={(e) => updateField(['electrical', 'elec_boiler'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Wall */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Internal Wall Finish</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="internal_wall_finish" className="form-label">
                      Finish Type
                    </label>
                    <select
                      className="form-select"
                      id="internal_wall_finish"
                      value={formState.internal_wall?.finish || 'none'}
                      onChange={(e) => updateField(['internal_wall', 'finish'], e.target.value)}
                      disabled={isLoading}
                    >
                      <option value="none">None</option>
                      <option value="panel">Panel</option>
                      <option value="skim_paint">Skim & Paint</option>
                    </select>
                  </div>
                  {formState.internal_wall?.finish !== 'none' && (
                    <div className="col-md-6">
                      <label htmlFor="internal_wall_area" className="form-label">
                        Wall Area (sqm)
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        id="internal_wall_area"
                        value={formState.internal_wall?.areaSqM || ''}
                        onChange={(e) => updateField(['internal_wall', 'areaSqM'], e.target.value)}
                        step="0.1"
                        min="0"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Glazing */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Glazing (Windows, Doors, Skylights)</h5>
              </div>
              <div className="card-body">
                {renderGlazingSection('windows', 'Windows')}
                {renderGlazingSection('externalDoors', 'External Doors')}
                {renderGlazingSection('skylights', 'Skylights')}
              </div>
            </div>

            {/* Floor */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Flooring</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="floor_type" className="form-label">
                      Floor Type
                    </label>
                    <select
                      className="form-select"
                      id="floor_type"
                      value={formState.floor?.type || 'none'}
                      onChange={(e) => updateField(['floor', 'type'], e.target.value)}
                      disabled={isLoading}
                    >
                      <option value="none">None</option>
                      <option value="wooden">Wooden</option>
                      <option value="tile">Tile</option>
                    </select>
                  </div>
                  {formState.floor?.type !== 'none' && (
                    <div className="col-md-6">
                      <label htmlFor="floor_area" className="form-label">
                        Floor Area (sqm)
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        id="floor_area"
                        value={formState.floor?.areaSqM || ''}
                        onChange={(e) => updateField(['floor', 'areaSqM'], e.target.value)}
                        step="0.1"
                        min="0"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Delivery</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="delivery_distance" className="form-label">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="delivery_distance"
                      value={formState.delivery?.distanceKm || ''}
                      onChange={(e) => updateField(['delivery', 'distanceKm'], e.target.value)}
                      step="0.1"
                      min="0"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="delivery_cost" className="form-label">
                      Fixed Cost (£)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="delivery_cost"
                      value={formState.delivery?.cost || ''}
                      onChange={(e) => updateField(['delivery', 'cost'], e.target.value)}
                      step="0.01"
                      min="0"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Extras */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Extras</h5>
              </div>
              <div className="card-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label htmlFor="extras_esp_insulation" className="form-label">
                      ESP Insulation (sqm)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="extras_esp_insulation"
                      value={formState.extras?.esp_insulation || ''}
                      onChange={(e) => updateField(['extras', 'esp_insulation'], e.target.value)}
                      step="0.1"
                      min="0"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="extras_render" className="form-label">
                      Render (sqm)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="extras_render"
                      value={formState.extras?.render || ''}
                      onChange={(e) => updateField(['extras', 'render'], e.target.value)}
                      step="0.1"
                      min="0"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="extras_steel_door" className="form-label">
                      Steel Doors (count)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="extras_steel_door"
                      value={formState.extras?.steel_door || ''}
                      onChange={(e) => updateField(['extras', 'steel_door'], e.target.value)}
                      min="0"
                      step="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="extras_concrete_foundation" className="form-label">
                      Concrete Foundation (sqm)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="extras_concrete_foundation"
                      value={formState.extras?.concrete_foundation || ''}
                      onChange={(e) => updateField(['extras', 'concrete_foundation'], e.target.value)}
                      step="0.1"
                      min="0"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Custom Extra Items */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-bold">Custom Extras</label>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={addExtraItem}
                      disabled={isLoading}
                    >
                      + Add Custom Extra
                    </button>
                  </div>
                  
                  {formState.extras?.other?.map((item) => (
                    <div key={item.id} className="row g-2 mb-2 p-2 border rounded">
                      <div className="col-md-6">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Item title"
                          value={item.title}
                          onChange={(e) => updateExtraItem(item.id, 'title', e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="col-md-4">
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          placeholder="Cost (£)"
                          value={item.cost}
                          onChange={(e) => updateExtraItem(item.id, 'cost', e.target.value)}
                          step="0.01"
                          min="0"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="col-md-2">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm w-100"
                          onClick={() => removeExtraItem(item.id)}
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Discount */}
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="card-title mb-0">Discount</h5>
              </div>
              <div className="card-body">
                <div className="col-md-6">
                  <label htmlFor="discount" className="form-label">
                    Discount Percentage (%)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="discount"
                    value={formState.discount || ''}
                    onChange={(e) => updateField(['discount'], e.target.value)}
                    step="0.1"
                    min="0"
                    max="100"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Additional Notes</h5>
          </div>
          <div className="card-body">
            <label htmlFor="notes" className="form-label">
              Notes
            </label>
            <textarea
              className="form-control"
              id="notes"
              rows={3}
              value={formState.notes || ''}
              onChange={(e) => updateField(['notes'], e.target.value)}
              placeholder="Any additional requirements or notes..."
              maxLength={2000}
              disabled={isLoading}
            />
            <small className="form-text text-muted">
              {formState.notes?.length || 0}/2000 characters
            </small>
          </div>
        </div>

        {/* Error Display */}
        {(Object.keys(validationErrors).length > 0 || Object.keys(externalErrors).length > 0) && (
          <div className="alert alert-danger mb-4">
            <h6>Please correct the following errors:</h6>
            <ul className="mb-0">
              {Object.values(validationErrors).map((error, index) => (
                <li key={index}>{typeof error === 'string' ? error : 'Invalid input'}</li>
              ))}
              {Object.values(externalErrors).map((error, index) => (
                <li key={`ext-${index}`}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <div className="d-grid">
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isLoading || !formState.size.widthM || !formState.size.depthM}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Calculating...
              </>
            ) : (
              'Calculate Price'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CalculatorForm;