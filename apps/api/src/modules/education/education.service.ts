import { Injectable } from '@nestjs/common';
import {
  EDUCATION_DATASETS,
  EDUCATION_GAP_MODULES,
  EDUCATION_ROADMAP,
  type EducationProduct,
} from './education-catalog';

@Injectable()
export class EducationService {
  modules(product?: EducationProduct) {
    const modules = product
      ? EDUCATION_GAP_MODULES.filter((module) => module.product === product)
      : EDUCATION_GAP_MODULES;

    return modules.map((module) => ({ ...module }));
  }

  datasets(product?: EducationProduct) {
    const datasets = product
      ? EDUCATION_DATASETS.filter((dataset) => dataset.owner.includes(product))
      : EDUCATION_DATASETS;

    return datasets.map((dataset) => {
      const copy = {
        ...dataset,
        owner: [...dataset.owner],
        requiredFields: [...dataset.requiredFields],
      };

      if (product === 'eschool' && dataset.standard === 'DAPODIK') {
        return {
          ...copy,
          importEndpoint: copy.importEndpoint?.replace('/pesantren/dapodik/', '/eschool/dapodik/'),
          exportEndpoint: copy.exportEndpoint?.replace('/pesantren/dapodik/', '/eschool/dapodik/'),
          templateEndpoint: copy.templateEndpoint?.replace('/pesantren/dapodik/', '/eschool/dapodik/'),
        };
      }

      return copy;
    });
  }

  roadmap() {
    return EDUCATION_ROADMAP.map((item) => ({
      ...item,
      items: [...item.items],
    }));
  }
}
